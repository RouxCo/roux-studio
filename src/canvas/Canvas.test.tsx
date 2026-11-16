// src/canvas/Canvas.test.tsx
// M4 Job 2: the canvas injects one <style id="roux-compiled"> with compiled r-{hash} rules.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Canvas from './Canvas';
import type { Node } from '../types';
import { useEditorStore } from '../store/useEditorStore';

const PAGE = {
  id: 'page-1', type: 'page', parentId: null, children: ['box-1'], styles: {}, hidden: {}, locked: false,
  title: 'Home', slug: 'home', backgroundLayers: [],
} as unknown as Node;
const BOX = {
  id: 'box-1', type: 'box', parentId: 'page-1', children: [],
  styles: { display: { desktop: 'flex' }, padding: { desktop: { kind: 'px', value: 16 } } },
  hidden: {}, locked: false,
} as unknown as Node;

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('Canvas compiled CSS', () => {
  it('injects exactly one #roux-compiled style into the iframe head', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    useEditorStore.setState({
      pages: [{ id: 'pg-1', rootId: 'page-1', title: 'Home', slug: 'home' }],
      currentPageId: 'pg-1',
    } as never);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const nodes = { [PAGE.id]: PAGE, [BOX.id]: BOX };
    act(() => {
      createRoot(container).render(<Canvas page={PAGE} nodes={nodes} breakpoint="desktop" />);
    });
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    act(() => {
      iframe.dispatchEvent(new Event('load'));
    });
    const doc = iframe.contentDocument!;
    const styles = doc.querySelectorAll('#roux-compiled');
    expect(styles.length).toBe(1);
    expect(styles[0]!.textContent).toContain('.r-');
  });
});
