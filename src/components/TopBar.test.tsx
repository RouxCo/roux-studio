// src/components/TopBar.test.tsx
// Job 3 — Top bar: breakpoint toggles, zoom control, undo/redo wired to the store.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import { emptyEditorData } from '../types';
import TopBar from './TopBar';

function renderTopBar() {
  useEditorStore.setState({
    ...emptyEditorData(),
    breakpoint: 'desktop',
    zoom: 1,
    history: [],
    historyIndex: -1,
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: ReturnType<typeof createRoot>;
  act(() => {
    root = createRoot(container);
    root.render(<TopBar />);
  });
  return container;
}

function bpButton(container: HTMLElement, id: string) {
  const label = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' }[id];
  const width = { desktop: 1440, tablet: 768, mobile: 390 }[id];
  const el = container.querySelector(`button[title="${label} (${width}px)"]`);
  if (!el) throw new Error(`no breakpoint button for ${id}`);
  return el as HTMLButtonElement;
}

afterEach(() => {
  document.body.innerHTML = '';
  useEditorStore.setState({ ...emptyEditorData(), selection: [], clipboard: null });
});

describe('TopBar', () => {
  it('switches the store breakpoint when a toggle is clicked', () => {
    const container = renderTopBar();
    expect(useEditorStore.getState().breakpoint).toBe('desktop');

    act(() => bpButton(container, 'tablet').click());
    expect(useEditorStore.getState().breakpoint).toBe('tablet');
    expect(bpButton(container, 'tablet').getAttribute('aria-pressed')).toBe('true');
    expect(bpButton(container, 'desktop').getAttribute('aria-pressed')).toBe('false');

    act(() => bpButton(container, 'mobile').click());
    expect(useEditorStore.getState().breakpoint).toBe('mobile');

    act(() => bpButton(container, 'desktop').click());
    expect(useEditorStore.getState().breakpoint).toBe('desktop');
  });

  it('changes zoom via the select and the stepper buttons', () => {
    const container = renderTopBar();
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('1');

    act(() => {
      select.value = '1.5';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(useEditorStore.getState().zoom).toBe(1.5);
    expect(select.value).toBe('1.5');

    const zoomIn = container.querySelector('button[aria-label="Zoom in"]') as HTMLButtonElement;
    act(() => zoomIn.click());
    expect(useEditorStore.getState().zoom).toBe(1.75);
    // 1.75 isn't a preset level, so the controlled select can't reflect it;
    // the store value is the source of truth.

    const zoomOut = container.querySelector('button[aria-label="Zoom out"]') as HTMLButtonElement;
    act(() => zoomOut.click());
    expect(useEditorStore.getState().zoom).toBe(1.5);

    // Zoom is clamped at the bounds.
    act(() => {
      useEditorStore.getState().setZoom(0.25);
    });
    expect(useEditorStore.getState().zoom).toBe(0.25);
    expect(zoomOut.disabled).toBe(true);

    act(() => {
      useEditorStore.getState().setZoom(4);
    });
    expect(useEditorStore.getState().zoom).toBe(4);
    expect(zoomIn.disabled).toBe(true);
  });

  it('undo/redo buttons are disabled when nothing can be undone or redone', () => {
    const container = renderTopBar();
    const undo = container.querySelector('button[aria-label="Undo"]') as HTMLButtonElement;
    const redo = container.querySelector('button[aria-label="Redo"]') as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);

    act(() => {
      useEditorStore.getState().setProjectName('Alpha');
    });
    expect(undo.disabled).toBe(false);

    act(() => {
      useEditorStore.getState().undo();
    });
    expect(redo.disabled).toBe(false);
    expect(undo.disabled).toBe(true);

    act(() => {
      useEditorStore.getState().redo();
    });
    expect(redo.disabled).toBe(true);
    expect(undo.disabled).toBe(false);
  });
});
