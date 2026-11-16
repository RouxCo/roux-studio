// src/components/AppKeyboard.test.tsx
// Job 6 — Global keyboard shortcuts handled by App (Del, Ctrl/Cmd + Z / Shift+Z /
// C / V / D / X), dispatched as KeyboardEvents on window.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
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
    act(() => { useEditorStore.getState().setSelection(['box-1']); });
    keyDown('Delete');
    expect(useEditorStore.getState().nodes['box-1']).toBeUndefined();
    expect(useEditorStore.getState().nodes['sec-1']!.children).not.toContain('box-1');
  });

  it('copies selection with Ctrl+C', () => {
    renderApp();
    act(() => { useEditorStore.getState().setSelection(['box-1']); });
    keyDown('c', { ctrl: true });
    const clip = useEditorStore.getState().clipboard;
    expect(clip).not.toBeNull();
    expect(clip!.roots).toEqual(['box-1']);
    expect(clip!.nodes['box-1']).toBeDefined();
  });

  it('pastes with Ctrl+V under the selected node parent', () => {
    renderApp();
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
    act(() => { useEditorStore.getState().setSelection(['box-1']); });
    const boxesBefore = Object.values(useEditorStore.getState().nodes).filter((n) => n.type === 'box').length;
    keyDown('d', { ctrl: true });
    const boxesAfter = Object.values(useEditorStore.getState().nodes).filter((n) => n.type === 'box').length;
    expect(boxesAfter).toBe(boxesBefore + 1);
  });

  it('cuts selection with Ctrl+X', () => {
    renderApp();
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
});
