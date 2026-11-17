// src/components/ContextMenu.test.tsx
// Job 6 — Context menu button gating by selection, clipboard and undo/redo state.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import ContextMenu from './ContextMenu';
import { emptyEditorData } from '../types';

let root!: ReturnType<typeof createRoot>;

function renderMenu() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<ContextMenu open={true} x={100} y={100} onClose={() => {}} />);
  });
  return container;
}

function btn(container: HTMLElement, label: string) {
  const el = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.includes(label),
  );
  if (!el) throw new Error(`no button for ${label}`);
  return el as HTMLButtonElement;
}

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  useEditorStore.setState({
    ...emptyEditorData(),
    selection: [],
    clipboard: null,
    history: [],
    historyIndex: -1,
  });
});

describe('ContextMenu gating', () => {
  it('disables everything with no selection, clipboard, or history', () => {
    const container = renderMenu();
    expect(btn(container, 'Undo').disabled).toBe(true);
    expect(btn(container, 'Redo').disabled).toBe(true);
    expect(btn(container, 'Cut').disabled).toBe(true);
    expect(btn(container, 'Copy').disabled).toBe(true);
    expect(btn(container, 'Paste').disabled).toBe(true);
    expect(btn(container, 'Duplicate').disabled).toBe(true);
    expect(btn(container, 'Delete').disabled).toBe(true);
  });

  it('enables cut/copy/duplicate/delete when a node is selected', () => {
    act(() => { useEditorStore.getState().setSelection(['box-1']); });
    const container = renderMenu();
    expect(btn(container, 'Cut').disabled).toBe(false);
    expect(btn(container, 'Copy').disabled).toBe(false);
    expect(btn(container, 'Duplicate').disabled).toBe(false);
    expect(btn(container, 'Delete').disabled).toBe(false);
    expect(btn(container, 'Paste').disabled).toBe(true);
  });

  it('enables paste when there is clipboard content', () => {
    act(() => {
      useEditorStore.setState((s) => ({
        nodes: { ...s.nodes, 'box-1': { id: 'box-1', type: 'box', parentId: null, children: [], styles: {}, hidden: {}, locked: false } },
      }));
      useEditorStore.getState().copy(['box-1']);
    });
    const container = renderMenu();
    expect(btn(container, 'Paste').disabled).toBe(false);
  });

  it('enables undo when there is history', () => {
    act(() => { useEditorStore.getState().setProjectName('Renamed'); });
    const container = renderMenu();
    expect(btn(container, 'Undo').disabled).toBe(false);
  });

  it('disables undo after it has been used and enables redo', () => {
    act(() => {
      useEditorStore.getState().setProjectName('Renamed');
      useEditorStore.getState().undo();
    });
    const container = renderMenu();
    expect(btn(container, 'Undo').disabled).toBe(true);
    expect(btn(container, 'Redo').disabled).toBe(false);
  });

  describe('Make global header/footer', () => {
    function seedPage() {
      act(() => {
        useEditorStore.setState({
          pages: [{ id: 'pg-1', rootId: 'page-1', title: 'Home', slug: 'home' }],
          currentPageId: 'pg-1',
          nodes: {
            'page-1': {
              id: 'page-1', type: 'page', parentId: null, children: ['sec-1'], styles: {},
              hidden: {}, locked: false, title: 'Home', slug: 'home', backgroundLayers: [],
            },
            'sec-1': {
              id: 'sec-1', type: 'section', parentId: 'page-1', children: [], styles: {},
              hidden: {}, locked: false,
              backgroundLayers: [], sectionBlend: { enabled: false, feather: 0, overlap: 0 },
            },
            'box-1': {
              id: 'box-1', type: 'box', parentId: 'sec-1', children: [], styles: {}, hidden: {}, locked: false,
            },
          },
          selection: [],
        });
      });
    }

    it('offers "Make global header" for a section that is a direct child of a page', () => {
      seedPage();
      act(() => { useEditorStore.getState().setSelection(['sec-1']); });
      const container = renderMenu();
      expect(btn(container, 'Make global header').disabled).toBe(false);
      act(() => { btn(container, 'Make global header').click(); });
      const get = () => useEditorStore.getState();
      expect(get().globalHeaderId).toBe('sec-1');
      expect(get().nodes['sec-1']!.parentId).toBeNull();
      expect(get().nodes['page-1']!.children).not.toContain('sec-1');
      expect(get().pages.find((p) => p.id === 'pg-1')!.useGlobalHeader).toBe(true);
    });

    it('offers "Make global footer" for a footer that is a direct child of a page', () => {
      seedPage();
      act(() => {
        const nodes = { ...useEditorStore.getState().nodes, 'sec-1': { ...useEditorStore.getState().nodes['sec-1']!, type: 'footer' } };
        useEditorStore.setState({ nodes, selection: ['sec-1'] });
      });
      const container = renderMenu();
      expect(btn(container, 'Make global footer').disabled).toBe(false);
      act(() => { btn(container, 'Make global footer').click(); });
      expect(useEditorStore.getState().globalFooterId).toBe('sec-1');
    });

    it('hides the make actions behind the selection rules', () => {
      seedPage();
      // A box nested in a section is not a direct page-root child.
      act(() => { useEditorStore.getState().setSelection(['box-1']); });
      let container = renderMenu();
      expect(btn(container, 'Make global header').disabled).toBe(true);
      expect(btn(container, 'Make global footer').disabled).toBe(true);

      // Already the global header: making it again is a no-op, so the item is off.
      act(() => {
        useEditorStore.getState().makeGlobalHeader('sec-1');
        useEditorStore.getState().setSelection(['sec-1']);
      });
      container = renderMenu();
      expect(btn(container, 'Make global header').disabled).toBe(true);
    });
  });
});
