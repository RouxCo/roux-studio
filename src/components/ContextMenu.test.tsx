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
});
