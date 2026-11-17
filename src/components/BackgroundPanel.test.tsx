// src/components/BackgroundPanel.test.tsx
// Background panel: show/hide for page/section, add layer, eye toggle,
// moveLayer as one undo step, opacity drag as one undo step, slideshow clamp.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import type { BackgroundLayer, NodeId } from '../types';
import { emptyEditorData } from '../types';
import BackgroundPanel from './BackgroundPanel';

function pageNode(backgroundLayers: BackgroundLayer[] = []): any {
  return {
    id: 'page-1', type: 'page', parentId: null, children: [], styles: {},
    hidden: {}, locked: false, title: 'Home', slug: 'home', backgroundLayers,
  };
}

function sectionNode(backgroundLayers: BackgroundLayer[] = []): any {
  return {
    id: 'sec-1', type: 'section', parentId: 'page-1', children: [], styles: {},
    hidden: {}, locked: false, backgroundLayers,
    sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  };
}

function boxNode(): any {
  return {
    id: 'box-1', type: 'box', parentId: 'page-1', children: [], styles: {},
    hidden: {}, locked: false,
  };
}

function setup(node: any, selectedId: NodeId) {
  useEditorStore.setState({
    ...emptyEditorData(),
    pages: [{ id: 'page-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
    nodes: { [node.id]: node },
    currentPageId: 'page-1',
    selection: [selectedId],
    breakpoint: 'desktop',
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
    root.render(<BackgroundPanel nodeId={selectedId} />);
  });
  return { container, get: () => useEditorStore.getState() };
}

afterEach(() => {
  document.body.innerHTML = '';
  useEditorStore.setState({ ...emptyEditorData(), selection: [], clipboard: null });
});

function addLayerButton(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector('button[aria-label="Add background layer"]');
  if (!el) throw new Error('no Add layer button');
  return el as HTMLButtonElement;
}

function kindButton(container: HTMLElement, label: string): HTMLButtonElement {
  const el = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === label,
  );
  if (!el) throw new Error(`no kind button ${label}`);
  return el as HTMLButtonElement;
}

function defaultLayer(type: string, overrides: Record<string, unknown> = {}): any {
  return {
    id: overrides.id ?? 'layer-1',
    type,
    enabled: true,
    opacity: 1,
    blendMode: 'normal',
    ...overrides,
  };
}

describe('BackgroundPanel', () => {
  it('renders only for page and section nodes', () => {
    const { container: pageContainer } = setup(pageNode(), 'page-1');
    expect(pageContainer.textContent).toContain('Background');

    const { container: sectionContainer } = setup(sectionNode(), 'sec-1');
    expect(sectionContainer.textContent).toContain('Background');

    const { container: boxContainer } = setup(boxNode(), 'box-1');
    expect(boxContainer.textContent).not.toContain('Background');
    expect(boxContainer.querySelector('section')).toBeNull();
  });

  it('adds a layer at the top of the stack via the add menu', () => {
    const existing = defaultLayer('color', { id: 'existing' });
    const { container, get } = setup(pageNode([existing]), 'page-1');

    act(() => addLayerButton(container).click());
    act(() => kindButton(container, 'Color').click());

    const state = get();
    const layers = (state.nodes['page-1'] as any).backgroundLayers;
    expect(layers[0].type).toBe('color');
    expect(layers.length).toBe(2);
    expect(state.historyIndex).toBe(0);
    expect(state.history).toHaveLength(1);
  });

  it('hides a layer via the eye button', () => {
    const { container, get } = setup(pageNode(), 'page-1');

    act(() => addLayerButton(container).click());
    act(() => kindButton(container, 'Color').click());

    const eye = container.querySelector('button[aria-label="Show layer"]') as HTMLButtonElement;
    act(() => eye.click());

    expect((get().nodes['page-1'] as any).backgroundLayers[0].enabled).toBe(false);
    expect(container.querySelector('button[aria-label="Hide layer"]')).not.toBeNull();
  });

  it('records one undo step for a moveLayer reorder', () => {
    const a = defaultLayer('color', { id: 'a' });
    const b = defaultLayer('color', { id: 'b' });
    const { get } = setup(pageNode([a, b]), 'page-1');

    act(() => {
      get().moveLayer('page-1', 0, 1);
    });

    const state = get();
    const layers = (state.nodes['page-1'] as any).backgroundLayers;
    expect(layers[0].id).toBe('b');
    expect(layers[1].id).toBe('a');
    expect(state.historyIndex).toBe(0);
    expect(state.history).toHaveLength(1);
  });

  it('coalesces an opacity drag (beginBatch, 3 changes, endBatch) into ONE undo step', () => {
    const { container, get } = setup(pageNode(), 'page-1');

    act(() => addLayerButton(container).click());
    act(() => kindButton(container, 'Color').click());
    const layerId = (get().nodes['page-1'] as any).backgroundLayers[0].id;

    act(() => {
      get().beginBatch();
      get().updateLayer('page-1', layerId, { opacity: 0.5 });
      get().updateLayer('page-1', layerId, { opacity: 0.3 });
      get().updateLayer('page-1', layerId, { opacity: 0.7 });
      get().endBatch();
    });

    const state = get();
    const layers = (state.nodes['page-1'] as any).backgroundLayers;
    expect(layers[0].opacity).toBe(0.7);
    // One drag = one undo step, not three: exactly one new history entry.
    expect(state.history).toHaveLength(2);
    expect(state.historyIndex).toBe(1);
  });

  it('shows the clamped slideshow interval (2000 for an input of 500)', () => {
    const s = defaultLayer('slideshow', { id: 's', srcs: [], interval: 500 });
    const { container, get } = setup(pageNode([s]), 'page-1');

    // Expand the row to reveal the slideshow controls and clamp readout.
    const row = Array.from(container.querySelectorAll('div')).find((d) =>
      d.textContent?.includes('slideshow'),
    )!;
    act(() => {
      const chevron = row.querySelector('button[aria-expanded="false"]') as HTMLButtonElement;
      chevron.click();
    });

    expect(container.textContent).toContain('Clamped: interval 2000 ms');

    // Editing the interval updates the stored value (and thus the clamp readout).
    act(() => {
      get().updateLayer('page-1', 's', { interval: 1500 });
    });
    expect((get().nodes['page-1'] as any).backgroundLayers[0].interval).toBe(1500);
  });
});
