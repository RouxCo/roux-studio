// src/components/Inspector.test.tsx
// Inspector: empty state, per-section rendering, resolved values, override dot,
// one-click reset, and breakpoint resolution (mobile ?? tablet ?? desktop).
//
// Note: React 19 + jsdom does not fire `onChange` for programmatic input events,
// so value *editing* is exercised through the store's patchNode (the same path the
// component's onChange uses) and through the reset-button click (click events do
// fire in this environment).
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import type { BoxNode, Breakpoint, NodeId } from '../types';
import { emptyEditorData } from '../types';
import Inspector from './Inspector';

function box(id: NodeId, styles: Record<string, unknown> = {}): BoxNode {
  return {
    id,
    type: 'box',
    parentId: null,
    children: [],
    styles: styles as never,
    hidden: {},
    locked: false,
  };
}

function renderInspector(
  nodes: Record<NodeId, BoxNode>,
  selection: NodeId[],
  breakpoint: Breakpoint = 'desktop',
) {
  useEditorStore.setState({
    ...emptyEditorData(),
    nodes,
    selection,
    breakpoint,
    zoom: 1,
    readOnly: false,
    remoteRevision: 0,
    history: [],
    historyIndex: -1,
    isBatching: false,
    pendingForward: [],
    pendingInverse: [],
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: ReturnType<typeof createRoot>;
  act(() => {
    root = createRoot(container);
    root.render(<Inspector />);
  });
  return { container, get: () => useEditorStore.getState() };
}

function inputFor(container: HTMLElement, placeholder: string): HTMLInputElement {
  return container.querySelector(`input[placeholder="${placeholder}"]`) as HTMLInputElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Inspector', () => {
  it('shows an empty state when nothing is selected', () => {
    const { container } = renderInspector({}, [], 'desktop');
    expect(container.textContent).toContain('Select a node');
  });

  it('renders the four sections when a node is selected', () => {
    const { container } = renderInspector({ box1: box('box1') }, ['box1'], 'desktop');
    for (const title of ['Layout', 'Typography', 'Colors', 'Spacing']) {
      expect(container.textContent).toContain(title);
    }
  });

  it('displays the resolved value for the active breakpoint', () => {
    const node = box('box1');
    node.styles = { width: { desktop: { kind: 'px', value: 100 } } } as never;
    const { container } = renderInspector({ box1: node }, ['box1'], 'desktop');
    expect(inputFor(container, 'e.g. 100%').value).toBe('100px');
  });

  it('shows the override dot only for a style overridden at the active breakpoint', () => {
    const node = box('box1');
    node.styles = { width: { desktop: { kind: 'px', value: 200 } } } as never;
    const { container } = renderInspector({ box1: node }, ['box1'], 'desktop');
    expect(container.querySelector('[title="Override at desktop"]')).not.toBeNull();
    expect(container.querySelector('[title="Override at tablet"]')).toBeNull();
  });

  it('does not show a dot for a style with no override', () => {
    const { container } = renderInspector({ box1: box('box1') }, ['box1'], 'desktop');
    expect(container.querySelector('[title="Override at desktop"]')).toBeNull();
  });

  it('resets an override back to the base via the reset button', () => {
    const node = box('box1');
    node.styles = { width: { desktop: { kind: 'px', value: 200 } } } as never;
    const { container, get } = renderInspector({ box1: node }, ['box1'], 'desktop');
    expect(get().nodes['box1']?.styles.width).toEqual({ desktop: { kind: 'px', value: 200 } });

    const reset = container.querySelector('[title="Reset to base"]') as HTMLButtonElement;
    act(() => reset.click());
    expect(get().nodes['box1']?.styles.width).toEqual({});
    expect(container.querySelector('[title="Override at desktop"]')).toBeNull();
  });

  it('resolves the active breakpoint value (mobile ?? tablet ?? desktop)', () => {
    const node = box('box1');
    node.styles = {
      width: { desktop: { kind: 'px', value: 100 }, mobile: { kind: 'px', value: 40 } },
    } as never;
    const { container } = renderInspector({ box1: node }, ['box1'], 'mobile');
    expect(inputFor(container, 'e.g. 100%').value).toBe('40px');
  });

  it('writes a breakpoint override through the store (the onChange path)', () => {
    const { get } = renderInspector({ box1: box('box1') }, ['box1'], 'desktop');
    get().patchNode('box1', (draft) => {
      const styles = draft.styles as unknown as Record<string, Record<string, unknown> | undefined>;
      styles.width = { ...(styles.width ?? {}), desktop: { kind: 'px', value: 200 } };
    });
    expect(get().nodes['box1']?.styles.width).toEqual({ desktop: { kind: 'px', value: 200 } });
  });
});
