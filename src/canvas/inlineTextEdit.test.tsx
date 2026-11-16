// src/canvas/inlineTextEdit.test.tsx
// Inline text editing on double-click (spec §4.4):
// - canvas text nodes render static with data-node-id + a double-click handler
// - double-click enters contentEditable edit mode
// - blur saves the new text exactly once as one undo step (patchNode)
// - Escape cancels without saving; Enter commits via blur
// - export mode stays static (never contentEditable)
import type { JSX } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderNode, type RenderContext } from './renderNode';
import { useEditorStore } from '../store/useEditorStore';
import type { Node, NodeId } from '../types';
import { emptyEditorData } from '../types';

function textNodeData(id: NodeId = 't-1', text = 'Hello'): Node {
  return {
    id,
    type: 'paragraph',
    parentId: null,
    children: [],
    styles: {},
    hidden: {},
    locked: false,
    text,
  } as unknown as Node;
}

function canvasCtx(node: Node, overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    mode: 'canvas',
    breakpoint: 'desktop',
    nodes: { [node.id]: node },
    editingNodeId: null,
    onStartEditing: vi.fn(),
    onSaveText: vi.fn(),
    onCancelEditing: vi.fn(),
    ...overrides,
  };
}

function mount(element: JSX.Element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: ReturnType<typeof createRoot>;
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('inline text editing', () => {
  it('renders a static tag with data-node-id and opens edit mode on double-click', () => {
    const node = textNodeData('p-1', 'Hello');
    const onStartEditing = vi.fn();
    const { container } = mount(
      renderNode(node, canvasCtx(node, { onStartEditing })),
    );
    const el = container.querySelector<HTMLElement>('[data-node-id="p-1"]');
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('Hello');
    expect(el?.getAttribute('contentEditable')).toBeNull();
    act(() => {
      el!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(onStartEditing).toHaveBeenCalledTimes(1);
    expect(onStartEditing).toHaveBeenCalledWith('p-1');
  });

  it('renders contentEditable when editingNodeId matches', () => {
    const node = textNodeData('p-1', 'Hello');
    const onSaveText = vi.fn();
    const onCancelEditing = vi.fn();
    const { container } = mount(
      renderNode(node, canvasCtx(node, {
        editingNodeId: node.id,
        onSaveText,
        onCancelEditing,
      })),
    );
    const el = container.querySelector<HTMLElement>('[data-node-id="p-1"]');
    expect(el?.contentEditable).toBe('true');
    expect(el?.dataset.editing).toBe('true');
    expect(el?.textContent).toBe('Hello');
  });

  it('saves the new text exactly once on blur', () => {
    const node = textNodeData('p-1', 'Hello');
    const onSaveText = vi.fn();
    const onCancelEditing = vi.fn();
    const { container } = mount(
      renderNode(node, canvasCtx(node, {
        editingNodeId: node.id,
        onSaveText,
        onCancelEditing,
      })),
    );
    const el = container.querySelector<HTMLElement>('[data-node-id="p-1"]')!;
    el.innerText = 'Hello world';
    act(() => {
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(onSaveText).toHaveBeenCalledTimes(1);
    expect(onSaveText).toHaveBeenCalledWith('p-1', 'Hello world');
    expect(onCancelEditing).not.toHaveBeenCalled();
    // A second blur does not save again (committed ref guards against double saves).
    act(() => {
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(onSaveText).toHaveBeenCalledTimes(1);
  });

  it('commits on Enter via blur', () => {
    const node = textNodeData('p-1', 'Hello');
    const onSaveText = vi.fn();
    const { container } = mount(
      renderNode(node, canvasCtx(node, { editingNodeId: node.id, onSaveText })),
    );
    const el = container.querySelector<HTMLElement>('[data-node-id="p-1"]')!;
    const blurSpy = vi.spyOn(el, 'blur');
    el.innerText = 'Changed';
    act(() => {
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });
    expect(blurSpy).toHaveBeenCalledTimes(1);
    act(() => {
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(onSaveText).toHaveBeenCalledTimes(1);
    expect(onSaveText).toHaveBeenCalledWith('p-1', 'Changed');
  });

  it('cancels on Escape without saving', () => {
    const node = textNodeData('p-1', 'Hello');
    const onSaveText = vi.fn();
    const onCancelEditing = vi.fn();
    const { container } = mount(
      renderNode(node, canvasCtx(node, {
        editingNodeId: node.id,
        onSaveText,
        onCancelEditing,
      })),
    );
    const el = container.querySelector<HTMLElement>('[data-node-id="p-1"]')!;
    act(() => {
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });
    expect(onCancelEditing).toHaveBeenCalledTimes(1);
    expect(onSaveText).not.toHaveBeenCalled();
  });

  it('stays static in export mode even when editingNodeId matches', () => {
    const node = textNodeData('p-1', 'Hello');
    const { container } = mount(
      renderNode(node, {
        mode: 'export',
        breakpoint: 'desktop',
        nodes: { [node.id]: node },
        editingNodeId: node.id,
        onSaveText: vi.fn(),
        onCancelEditing: vi.fn(),
      }),
    );
    const el = container.querySelector<HTMLParagraphElement>('p');
    expect(el?.textContent).toBe('Hello');
    expect(el?.dataset.editing).toBeUndefined();
  });

  it('patchNode saves text as one undo step', () => {
    const node = textNodeData('p-1', 'Hello');
    useEditorStore.setState({
      ...emptyEditorData(),
      nodes: { [node.id]: node },
    });
    useEditorStore.getState().patchNode(node.id, (draft) => {
      if (draft.type === 'paragraph') draft.text = 'Changed';
    });
    const saved = useEditorStore.getState().nodes[node.id]!;
    expect(saved.type).toBe('paragraph');
    expect((saved as Extract<Node, { type: 'paragraph' }>).text).toBe('Changed');
    expect(useEditorStore.getState().canUndo()).toBe(true);
    useEditorStore.getState().undo();
    const restored = useEditorStore.getState().nodes[node.id]!;
    expect((restored as Extract<Node, { type: 'paragraph' }>).text).toBe('Hello');
    expect(useEditorStore.getState().canUndo()).toBe(false);
  });
});
