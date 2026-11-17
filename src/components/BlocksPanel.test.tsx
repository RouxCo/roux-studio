// src/components/BlocksPanel.test.tsx
// Blocks panel: empty state, saving via context menu, inserting copies, rename,
// delete and insert fallbacks.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import type { BoxNode, Node, NodeId, SectionNode } from '../types';
import { emptyEditorData } from '../types';
import BlocksPanel from './BlocksPanel';
import ContextMenu from './ContextMenu';

let root!: ReturnType<typeof createRoot>;

function pageNode(): Node {
  return {
    id: 'page-1', type: 'page', parentId: null, children: ['sec-1'],
    styles: {}, hidden: {}, locked: false, title: 'Home', slug: 'home', backgroundLayers: [],
  };
}

function section(id: NodeId, parentId: NodeId | null = null): SectionNode {
  return {
    id, type: 'section', parentId, children: [],
    styles: {}, hidden: {}, locked: false,
    backgroundLayers: [], sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  };
}

function box(id: NodeId, parentId: NodeId | null = null): BoxNode {
  return {
    id, type: 'box', parentId, children: [], styles: {}, hidden: {}, locked: false,
  };
}

function renderBlocks(selection: NodeId[] = []) {
  const existingBlocks = useEditorStore.getState().blocks;
  useEditorStore.setState({
    ...emptyEditorData(),
    pages: [{ id: 'page-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
    nodes: { 'page-1': pageNode() },
    currentPageId: 'page-1',
    selection,
    blocks: existingBlocks,
    history: [], historyIndex: -1,
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<BlocksPanel />);
  });
  return container;
}

function renderBlocksAndMenu(selection: NodeId[]) {
  const state = useEditorStore.getState();
  useEditorStore.setState({
    ...emptyEditorData(),
    pages: [{ id: 'page-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
    nodes: { ...state.nodes },
    currentPageId: 'page-1',
    selection,
    blocks: state.blocks,
    history: [], historyIndex: -1,
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(
      <>
        <BlocksPanel />
        <ContextMenu open={true} x={100} y={100} onClose={() => {}} />
      </>,
    );
  });
  return container;
}

function blockRow(container: HTMLElement, name: string): HTMLElement {
  const nameEl = Array.from(container.querySelectorAll('span')).find(
    (s) => s.textContent === name && !s.querySelector('input') && !s.closest('p'),
  );
  if (!nameEl) throw new Error(`no block row for ${name}`);
  const row = nameEl.parentElement?.parentElement?.parentElement as HTMLElement | null;
  if (!row) throw new Error(`no row div for ${name}`);
  return row;
}

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  useEditorStore.setState({
    ...emptyEditorData(),
    selection: [],
    history: [],
    historyIndex: -1,
  });
});

describe('BlocksPanel', () => {
  it('shows the empty state with no blocks', () => {
    const container = renderBlocks();
    expect(container.textContent).toContain('No blocks yet');
    expect(container.textContent).toContain('Save as block');
  });

  it('saving a section via the context menu adds a row', () => {
    const store = useEditorStore.getState();
    store.addNode(section('sec-1'), null);
    store.setSelection(['sec-1']);

    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Hero block');
    const container = renderBlocksAndMenu(['sec-1']);

    act(() => {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Save as block'),
      );
      btn!.click();
    });

    expect(prompt).toHaveBeenCalledWith('Name the block', expect.stringContaining('block'));
    expect(container.textContent).toContain('Hero block');
    expect(useEditorStore.getState().blocks).toHaveLength(1);
    expect(useEditorStore.getState().blocks[0]!.name).toBe('Hero block');
  });

  it('clicking a block row twice inserts two independent copies with unique ids', () => {
    const store = useEditorStore.getState();
    store.addNode(section('sec-1'), null);
    store.addNode(box('child-1'), 'sec-1');
    store.saveAsBlock('sec-1', 'Hero');

    const container = renderBlocks();
    const stepsBefore = useEditorStore.getState().history.length;

    act(() => blockRow(container, 'Hero').click());
    expect(useEditorStore.getState().history.length).toBe(stepsBefore + 1); // one undo step
    const root1 = useEditorStore.getState().selection[0]!;

    act(() => blockRow(container, 'Hero').click());
    expect(useEditorStore.getState().history.length).toBe(stepsBefore + 2); // one undo step each
    const root2 = useEditorStore.getState().selection[0]!;

    expect(root2).not.toBe(root1);
    const state = useEditorStore.getState();
    const tree1 = collect(state.nodes, root1);
    const tree2 = collect(state.nodes, root2);
    const all = new Set([...tree1, ...tree2]);
    expect(all.size).toBe(tree1.length + tree2.length);
    // Neither copy reuses the block's snapshot ids.
    const block = state.blocks[0]!;
    expect(tree1.some((id) => block.nodes[id])).toBe(false);
    expect(tree2.some((id) => block.nodes[id])).toBe(false);
  });

  it('inserting a section block while a box is selected falls back to the page root and never throws', () => {
    const store = useEditorStore.getState();
    store.addNode(section('sec-1'), null);
    store.addNode(box('box-1'), 'sec-1');
    store.saveAsBlock('sec-1', 'Hero');
    store.setSelection(['box-1']);

    const container = renderBlocks();
    expect(() => act(() => blockRow(container, 'Hero').click())).not.toThrow();

    const state = useEditorStore.getState();
    const heroRoot = state.selection[0]!;
    expect(state.nodes[heroRoot]!.parentId).toBe('page-1');
  });

  it('rename works', () => {
    const store = useEditorStore.getState();
    store.addNode(section('sec-1'), null);
    store.saveAsBlock('sec-1', 'Hero');

    const container = renderBlocks();
    expect(container.textContent).toContain('Hero');

    act(() => {
      useEditorStore.getState().renameBlock(useEditorStore.getState().blocks[0]!.id, 'Renamed');
    });

    expect(useEditorStore.getState().blocks[0]!.name).toBe('Renamed');
    expect(container.textContent).toContain('Renamed');
    expect(container.textContent).not.toContain('Hero');
  });

  it('delete works with window.confirm', () => {
    const store = useEditorStore.getState();
    store.addNode(section('sec-1'), null);
    store.saveAsBlock('sec-1', 'Hero');

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const container = renderBlocks();

    act(() => {
      const btn = blockRow(container, 'Hero').querySelector('button[aria-label="Delete"]') as HTMLButtonElement;
      btn.click();
    });

    expect(confirm).toHaveBeenCalledWith('Delete block "Hero"?');
    expect(useEditorStore.getState().blocks).toEqual([]);
    expect(container.textContent).toContain('No blocks yet');
  });
});

function collect(nodes: Record<NodeId, Node>, root: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const stack: NodeId[] = [root];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = nodes[id];
    if (!node || out.includes(id)) continue;
    out.push(id);
    for (const c of node.children) stack.push(c);
  }
  return out;
}
