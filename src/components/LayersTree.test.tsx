// src/components/LayersTree.test.tsx
// Job 2 — Layers tree: render the seeded page tree, click a row to select
// (synced with the store), and collapse/expand children.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import type { NodeId, Node } from '../types';
import { emptyEditorData } from '../types';
import LayersTree from './LayersTree';

function pageNode(): Node {
  return {
    id: 'page-1', type: 'page', parentId: null, children: ['sec-1'],
    styles: {}, hidden: {}, locked: false, title: 'Home', slug: 'home', backgroundLayers: [],
  };
}

function sectionNode(id: NodeId, children: NodeId[] = []): Node {
  return {
    id, type: 'section', parentId: 'page-1', children,
    styles: {}, hidden: {}, locked: false,
    backgroundLayers: [], sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  };
}

function boxNode(id: NodeId, parentId: NodeId, children: NodeId[] = []): Node {
  return { id, type: 'box', parentId, children, styles: {}, hidden: {}, locked: false };
}

function headingNode(id: NodeId, parentId: NodeId): Node {
  return { id, type: 'heading', parentId, children: [], styles: {}, hidden: {}, locked: false, level: 1, text: 'Hello' };
}

function renderLayersTree(nodes: Record<NodeId, Node>, currentPageId: NodeId | null = 'page-1') {
  useEditorStore.setState({
    ...emptyEditorData(),
    pages: [{ id: 'page-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
    nodes,
    currentPageId,
    selection: [],
    zoom: 1,
    readOnly: false,
    remoteRevision: 0,
    history: [],
    historyIndex: -1,
    isBatching: false,
    pendingForward: [],
    pendingInverse: [],
    clipboard: null,
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: ReturnType<typeof createRoot>;
  act(() => {
    root = createRoot(container);
    root.render(<LayersTree />);
  });
  return { container, get: () => useEditorStore.getState() };
}

function row(container: HTMLElement, id: NodeId): HTMLElement {
  const el = container.querySelector(`[title="${id}"]`);
  if (!el) throw new Error(`no row for ${id}`);
  return el as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = '';
  useEditorStore.setState({ ...emptyEditorData(), selection: [], clipboard: null });
});

describe('LayersTree', () => {
  it('renders the page tree with labels and node ids', () => {
    const { container } = renderLayersTree({
      'page-1': pageNode(),
      'sec-1': sectionNode('sec-1', ['box-1']),
      'box-1': boxNode('box-1', 'sec-1', ['h-1']),
      'h-1': headingNode('h-1', 'box-1'),
    });
    expect(container.textContent).toContain('Home');
    expect(container.textContent).toContain('Section');
    expect(container.textContent).toContain('Box');
    expect(container.textContent).toContain('Hello');
    expect(row(container, 'box-1').textContent).toContain('box-1');
  });

  it('clicking a row selects the node in the store', () => {
    const { container, get } = renderLayersTree({
      'page-1': pageNode(),
      'sec-1': sectionNode('sec-1', ['box-1']),
      'box-1': boxNode('box-1', 'sec-1'),
    });
    act(() => row(container, 'box-1').click());
    expect(get().selection).toEqual(['box-1']);

    act(() => row(container, 'sec-1').click());
    expect(get().selection).toEqual(['sec-1']);
  });

  it('collapse hides children and expand shows them again', () => {
    const { container } = renderLayersTree({
      'page-1': pageNode(),
      'sec-1': sectionNode('sec-1', ['box-1']),
      'box-1': boxNode('box-1', 'sec-1', ['h-1']),
      'h-1': headingNode('h-1', 'box-1'),
    });
    expect(container.textContent).toContain('Box');
    expect(container.textContent).toContain('Hello');

    const toggle = row(container, 'sec-1').querySelector('button') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    act(() => toggle.click());
    expect(container.textContent).not.toContain('Box');
    expect(container.textContent).not.toContain('Hello');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    act(() => toggle.click());
    expect(container.textContent).toContain('Box');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('leaf rows have no collapse button', () => {
    const { container } = renderLayersTree({
      'page-1': { ...pageNode(), children: ['box-1'] },
      'box-1': boxNode('box-1', 'page-1'),
    });
    expect(row(container, 'box-1').querySelector('button')).toBeNull();
  });

  it('shows "No page selected" when there is no page', () => {
    const { container } = renderLayersTree({}, null);
    expect(container.textContent).toContain('No page selected');
  });
});
