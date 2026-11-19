// src/canvas/SelectionOverlay.test.tsx
// SelectionOverlay (spec §4.5):
// - renders an outline + eight resize handles when a node is selected, nothing otherwise
// - positions the box from the element's getBoundingClientRect adjusted for iframe offset + zoom
// - click hit-test inside the iframe sets the store selection via data-node-id
import type { RefObject } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import type { NodeId } from '../types';
import { emptyEditorData } from '../types';
import SelectionOverlay from './SelectionOverlay';

function rect(l = 0, t = 0, w = 0, h = 0): DOMRect {
  return {
    left: l, top: t, width: w, height: h,
    x: l, y: t, right: l + w, bottom: t + h,
    toJSON: () => ({}),
  } as unknown as DOMRect;
}

// Fake iframe whose contentDocument resolves querySelector to a mock element.
function fakeIframe(elRect: DOMRect, frameRect: DOMRect) {
  const el = { getBoundingClientRect: vi.fn(() => elRect) } as unknown as HTMLElement;
  const querySelector = vi.fn<(selector: string) => HTMLElement | null>(() => el);
  const doc = {
    documentElement: {},
    querySelector,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Document;
  const iframe = {
    contentDocument: doc,
    contentWindow: { document: doc },
    getBoundingClientRect: vi.fn(() => frameRect),
  } as unknown as HTMLIFrameElement;
  return { iframe, doc, el, querySelector };
}

function mountOverlay(selection: NodeId[], zoom: number, iframe: HTMLIFrameElement) {
  const iframeRef = { current: iframe } as unknown as RefObject<HTMLIFrameElement | null>;
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: ReturnType<typeof createRoot>;
  act(() => {
    root = createRoot(container);
    root.render(<SelectionOverlay iframeRef={iframeRef} selection={selection} zoom={zoom} />);
  });
  return { container, root };
}

beforeEach(() => {
  useEditorStore.setState({
    ...emptyEditorData(),
    zoom: 1,
    readOnly: false,
    remoteRevision: 0,
    history: [], historyIndex: -1, isBatching: false, pendingForward: [], pendingInverse: [],
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('SelectionOverlay', () => {
  it('renders nothing when nothing is selected', () => {
    const { iframe } = fakeIframe(rect(), rect());
    const { container } = mountOverlay([], 1, iframe);
    expect(container.children).toHaveLength(0);
  });

  it('renders nothing when the selected element is not in the iframe', () => {
    const { iframe, querySelector } = fakeIframe(rect(), rect());
    querySelector.mockReturnValue(null);
    const { container } = mountOverlay(['node-1'], 1, iframe);
    expect(container.children).toHaveLength(0);
  });

  it('renders the outline and eight resize handles when selected', () => {
    const { iframe } = fakeIframe(rect(), rect());
    const { container } = mountOverlay(['node-1'], 1, iframe);
    expect(container.children).toHaveLength(1);
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.style.position).toBe('fixed');
    expect(overlay.style.border).toContain('rgb(59, 130, 246)');
    const handles = container.querySelectorAll<HTMLElement>('[data-handle]');
    expect(handles).toHaveLength(8);
    expect(Array.from(handles).map((h) => h.getAttribute('data-handle'))).toEqual(
      ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'],
    );
  });

  it('positions from the element rect plus the iframe offset scaled by zoom', () => {
    const elRect = rect(5, 6, 70, 30);
    const frameRect = rect(100, 200, 0, 0);
    // left = 100 + 5*2 = 110; top = 200 + 6*2 = 212; width = 70*2 = 140; height = 30*2 = 60
    const { iframe } = fakeIframe(elRect, frameRect);
    const { container } = mountOverlay(['node-1'], 2, iframe);
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.style.left).toBe('110px');
    expect(overlay.style.top).toBe('212px');
    expect(overlay.style.width).toBe('140px');
    expect(overlay.style.height).toBe('60px');
  });

  it('recomputes the position when the selection changes', () => {
    const first = rect(1, 2, 3, 4);
    const second = rect(9, 8, 7, 6);
    const { iframe, el, querySelector } = fakeIframe(first, rect());
    const { container } = mountOverlay(['node-1'], 1, iframe);
    let overlay = container.firstChild as HTMLElement;
    expect(overlay.style.left).toBe('1px');
    expect(overlay.style.top).toBe('2px');

    (el.getBoundingClientRect as ReturnType<typeof vi.fn>).mockReturnValue(second);
    const { container: c2 } = mountOverlay(['node-2'], 1, iframe);
    overlay = c2.firstChild as HTMLElement;
    expect(overlay.style.left).toBe('9px');
    expect(overlay.style.top).toBe('8px');
    expect(querySelector).toHaveBeenLastCalledWith('[data-node-id="node-2"]');
  });

  it('hit-testing a click inside the iframe sets the store selection', () => {
    const doc = document.implementation.createHTMLDocument('test');
    const target = doc.createElement('div');
    target.setAttribute('data-node-id', 'node-1');
    doc.body.appendChild(target);
    const iframe = {
      contentDocument: doc,
      contentWindow: { document: doc },
      getBoundingClientRect: vi.fn(() => rect()),
    } as unknown as HTMLIFrameElement;
    const setStateSpy = vi.spyOn(useEditorStore, 'setState');
    mountOverlay([], 1, iframe);
    act(() => {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(setStateSpy).toHaveBeenCalledTimes(1);
    expect(setStateSpy).toHaveBeenCalledWith({ selection: ['node-1'] });
  });
});
