// src/components/AppKeyboard.test.tsx
// Job 6 — Global keyboard shortcuts handled by App (Del, Ctrl/Cmd + Z / Shift+Z /
// C / V / D / X), dispatched as KeyboardEvents on window.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import type { Node, NodeId } from '../types';
import App from '../App';

let root!: ReturnType<typeof createRoot>;

function renderApp() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
}

function keyDown(key: string, mods: { ctrl?: boolean; shift?: boolean } = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      ctrlKey: !!mods.ctrl,
      shiftKey: !!mods.shift,
      bubbles: true,
    }));
  });
}

// Demo fixture — App no longer seeds the store, so tests that need existing
// nodes seed the store themselves (the store is now the single source of truth).
const DEMO_NODES: Record<NodeId, Node> = {
  'page-1': {
    id: 'page-1', type: 'page', parentId: null, children: ['sec-1'], styles: {}, hidden: {}, locked: false,
    title: 'Home', slug: 'home', backgroundLayers: [],
  },
  'sec-1': {
    id: 'sec-1', type: 'section', parentId: 'page-1', children: ['box-1'], styles: {},
    hidden: {}, locked: false, backgroundLayers: [], sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  },
  'box-1': {
    id: 'box-1', type: 'box', parentId: 'sec-1', children: ['h-1', 'p-1'], styles: {
      display: { desktop: 'flex' }, padding: { desktop: { kind: 'px', value: 24 } },
    }, hidden: {}, locked: false,
  },
  'h-1': {
    id: 'h-1', type: 'heading', parentId: 'box-1', children: [], styles: { color: { desktop: '#0f766e' } },
    hidden: {}, locked: false, level: 1, text: 'Roux and Co.',
  },
  'p-1': {
    id: 'p-1', type: 'paragraph', parentId: 'box-1', children: [], styles: { fontSize: { desktop: { kind: 'px', value: 16 } } },
    hidden: {}, locked: false, text: 'We build websites that work.',
  },
}

function seedDemo() {
  act(() => {
    useEditorStore.setState({
      pages: [{ id: 'page-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
      nodes: DEMO_NODES,
      currentPageId: 'page-1',
    })
  })
}

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  useEditorStore.setState({
    ...{ projectId: null, projectName: 'Untitled', pages: [], tokens: { byName: {} }, nodes: {}, currentPageId: null },
    breakpoint: 'desktop',
    selection: [],
    zoom: 1,
    clipboard: null,
    history: [],
    historyIndex: -1,
  });
});

describe('App keyboard shortcuts', () => {
  it('undoes with Ctrl+Z', () => {
    renderApp();
    act(() => { useEditorStore.getState().setProjectName('Renamed'); });
    expect(useEditorStore.getState().projectName).toBe('Renamed');
    expect(useEditorStore.getState().historyIndex).toBe(0);

    keyDown('z', { ctrl: true });
    expect(useEditorStore.getState().projectName).toBe('Untitled');
    expect(useEditorStore.getState().historyIndex).toBe(-1);
  });

  it('redoes with Ctrl+Shift+Z', () => {
    renderApp();
    act(() => { useEditorStore.getState().setProjectName('Renamed'); });
    keyDown('z', { ctrl: true });
    expect(useEditorStore.getState().projectName).toBe('Untitled');

    keyDown('z', { ctrl: true, shift: true });
    expect(useEditorStore.getState().projectName).toBe('Renamed');
    expect(useEditorStore.getState().historyIndex).toBe(0);
  });

  it('removes selected nodes with Delete', () => {
    renderApp();
    seedDemo();
    act(() => { useEditorStore.getState().setSelection(['box-1']); });
    keyDown('Delete');
    expect(useEditorStore.getState().nodes['box-1']).toBeUndefined();
    expect(useEditorStore.getState().nodes['sec-1']!.children).not.toContain('box-1');
  });

  it('copies selection with Ctrl+C', () => {
    renderApp();
    seedDemo();
    act(() => { useEditorStore.getState().setSelection(['box-1']); });
    keyDown('c', { ctrl: true });
    const clip = useEditorStore.getState().clipboard;
    expect(clip).not.toBeNull();
    expect(clip!.roots).toEqual(['box-1']);
    expect(clip!.nodes['box-1']).toBeDefined();
  });

  it('pastes with Ctrl+V under the selected node parent', () => {
    renderApp();
    seedDemo();
    act(() => {
      useEditorStore.getState().setSelection(['box-1']);
      useEditorStore.getState().copy(['box-1']);
    });
    const boxesBefore = Object.values(useEditorStore.getState().nodes).filter((n) => n.type === 'box').length;
    keyDown('v', { ctrl: true });
    const boxesAfter = Object.values(useEditorStore.getState().nodes).filter((n) => n.type === 'box').length;
    expect(boxesAfter).toBe(boxesBefore + 1);
  });

  it('duplicates selection with Ctrl+D', () => {
    renderApp();
    seedDemo();
    act(() => { useEditorStore.getState().setSelection(['box-1']); });
    const boxesBefore = Object.values(useEditorStore.getState().nodes).filter((n) => n.type === 'box').length;
    keyDown('d', { ctrl: true });
    const boxesAfter = Object.values(useEditorStore.getState().nodes).filter((n) => n.type === 'box').length;
    expect(boxesAfter).toBe(boxesBefore + 1);
  });

  it('cuts selection with Ctrl+X', () => {
    renderApp();
    seedDemo();
    act(() => { useEditorStore.getState().setSelection(['box-1']); });
    keyDown('x', { ctrl: true });
    expect(useEditorStore.getState().nodes['box-1']).toBeUndefined();
    expect(useEditorStore.getState().clipboard).not.toBeNull();
  });

  it('ignores shortcuts while typing into an input', () => {
    renderApp();
    act(() => { useEditorStore.getState().setProjectName('Renamed'); });
    expect(useEditorStore.getState().projectName).toBe('Renamed');
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    });
    expect(useEditorStore.getState().projectName).toBe('Renamed'); // unchanged — ignored
  });

  it('renders an empty state with a New project button when the store is empty', () => {
    renderApp();
    expect(document.body.textContent).toContain('No pages yet');
    expect(
      Array.from(document.querySelectorAll('button')).some(
        (b) => b.textContent === 'New project',
      ),
    ).toBe(true);
  });
});
