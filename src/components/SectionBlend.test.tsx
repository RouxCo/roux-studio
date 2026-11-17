// src/components/SectionBlend.test.tsx
// Section blend block in the Background panel: blend-with-previous/next and
// Clear buttons, Enabled checkbox, feather top/bottom and overlap inputs —
// section nodes only, disabled at the first/last section, and Clear takes the
// compiled mask-image away.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import type { NodeId, PageId, Project, SectionNode } from '../types';
import { emptyEditorData } from '../types';
import { compileStyles } from '../compile/compileStyles';
import BackgroundPanel from './BackgroundPanel';

const get = () => useEditorStore.getState();

function pageNode(): any {
  return {
    id: 'page-1', type: 'page', parentId: null, children: [], styles: {},
    hidden: {}, locked: false, title: 'Home', slug: 'home', backgroundLayers: [],
  };
}

function sectionNode(id: NodeId): SectionNode {
  return {
    id, type: 'section', parentId: 'page-1', children: [], styles: {},
    hidden: {}, locked: false, backgroundLayers: [],
    sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  };
}

const PROJECT: Project = {
  id: 'proj-1', name: 'Roux Studio',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  pages: [{ id: 'page-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
  tokens: { byName: {} },
};

function storeCss(): string {
  return compileStyles(PROJECT, 'page-1' as PageId, get().nodes);
}

function setup(ids: NodeId[], selectedId: NodeId) {
  const nodes: Record<NodeId, any> = {
    'page-1': { ...pageNode(), children: [...ids] },
  };
  for (const id of ids) nodes[id] = sectionNode(id);
  useEditorStore.setState({
    ...emptyEditorData(),
    pages: [{ id: 'page-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
    nodes,
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

function buttonByLabel(container: HTMLElement, label: string): HTMLButtonElement {
  const el = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === label,
  );
  if (!el) throw new Error(`no button ${label}`);
  return el as HTMLButtonElement;
}

describe('SectionBlendControls', () => {
  it('does not show the Section blend block for a page node', () => {
    const { container } = setup([], 'page-1');
    expect(container.textContent).toContain('Background');
    expect(container.textContent).not.toContain('Section blend');
  });

  it('shows the Section blend block for a section node', () => {
    const { container } = setup(['sec-1'], 'sec-1');
    expect(container.textContent).toContain('Section blend');
    expect(container.textContent).toContain('Blend with previous');
    expect(container.textContent).toContain('Blend with next');
    expect(container.textContent).toContain('Clear');
    expect(container.textContent).toContain('Feather top (px)');
    expect(container.textContent).toContain('Feather bottom (px)');
    expect(container.textContent).toContain('Overlap (px)');
  });

  it('disables Blend with previous on the first section and Blend with next on the last', () => {
    const { container } = setup(['sec-1', 'sec-2'], 'sec-1');
    expect(buttonByLabel(container, 'Blend with previous').disabled).toBe(true);
    expect(buttonByLabel(container, 'Blend with next').disabled).toBe(false);

    const { container: lastContainer } = setup(['sec-1', 'sec-2'], 'sec-2');
    expect(buttonByLabel(lastContainer, 'Blend with previous').disabled).toBe(false);
    expect(buttonByLabel(lastContainer, 'Blend with next').disabled).toBe(true);
  });

  it('Blend with next sets both sections in ONE undo step', () => {
    const { container, get } = setup(['sec-1', 'sec-2'], 'sec-1');
    act(() => buttonByLabel(container, 'Blend with next').click());

    expect(get().history).toHaveLength(1);
    const first = (get().nodes['sec-1'] as SectionNode).sectionBlend;
    const second = (get().nodes['sec-2'] as SectionNode).sectionBlend;
    expect(first.enabled).toBe(true);
    expect(first.featherBottom).toBe(120);
    expect(first.overlap).toBe(0);
    expect(second.enabled).toBe(true);
    expect(second.overlap).toBe(120);
    expect(second.featherTop).toBe(120);

    get().undo();
    expect((get().nodes['sec-1'] as SectionNode).sectionBlend).toEqual({
      enabled: false, feather: 0, overlap: 0,
    });
    expect((get().nodes['sec-2'] as SectionNode).sectionBlend).toEqual({
      enabled: false, feather: 0, overlap: 0,
    });
    expect(get().historyIndex).toBe(-1);
  });

  it('shows the hint until the section has a visible background layer', () => {
    const { container } = setup(['sec-1'], 'sec-1');
    expect(container.textContent).toContain('Add a background layer to see the blend.');

    act(() => {
      useEditorStore.setState((s) => ({
        nodes: {
          ...s.nodes,
          'sec-1': {
            ...(s.nodes['sec-1'] as SectionNode),
            backgroundLayers: [
              { id: 'bg-1', type: 'color', enabled: true, opacity: 1, blendMode: 'normal', color: '#ff0000' },
            ],
          },
        },
      }));
    });
    expect(container.textContent).not.toContain('Add a background layer to see the blend.');
  });

  it('Clear removes the blend and compileStyles then has no mask-image', () => {
    const { container } = setup(['sec-1'], 'sec-1');
    act(() => {
      useEditorStore.setState((s) => ({
        nodes: {
          ...s.nodes,
          'sec-1': {
            ...(s.nodes['sec-1'] as SectionNode),
            backgroundLayers: [
              { id: 'bg-1', type: 'color', enabled: true, opacity: 1, blendMode: 'normal', color: '#ff0000' },
            ],
            sectionBlend: { enabled: true, feather: 0, overlap: 0, featherTop: 120 },
          },
        },
      }));
    });

    expect(storeCss()).toContain('mask-image');

    act(() => buttonByLabel(container, 'Clear').click());

    const blend = (get().nodes['sec-1'] as SectionNode).sectionBlend;
    expect(blend).toEqual({ enabled: false, feather: 0, overlap: 0 });
    expect(blend.featherTop).toBeUndefined();
    expect(blend.featherBottom).toBeUndefined();
    expect(storeCss()).not.toContain('mask-image');
  });
});
