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

  describe('Canvas global header/footer banner', () => {
    const GLOBAL_NODES: Record<string, Node> = {
      'page-1': {
        id: 'page-1', type: 'page', parentId: null, children: ['box-1'], styles: {},
        hidden: {}, locked: false, title: 'Home', slug: 'home', backgroundLayers: [],
      },
      'head-1': {
        id: 'head-1', type: 'section', parentId: null, children: ['h-1'], styles: {},
        hidden: {}, locked: false,
        backgroundLayers: [], sectionBlend: { enabled: false, feather: 0, overlap: 0 },
      },
      'h-1': {
        id: 'h-1', type: 'heading', parentId: 'head-1', children: [], styles: {},
        hidden: {}, locked: false, level: 1, text: 'Global header',
      },
      'foot-1': {
        id: 'foot-1', type: 'footer', parentId: null, children: ['fp-1'], styles: {},
        hidden: {}, locked: false,
      },
      'fp-1': {
        id: 'fp-1', type: 'paragraph', parentId: 'foot-1', children: [], styles: {},
        hidden: {}, locked: false, text: 'Global footer',
      },
      'box-1': {
        id: 'box-1', type: 'box', parentId: 'page-1', children: [], styles: {},
        hidden: {}, locked: false,
      },
    };

    function renderCanvas(footer = false) {
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
      vi.stubGlobal('cancelAnimationFrame', () => {});
      useEditorStore.setState({
        pages: [{ id: 'pg-1', rootId: 'page-1', title: 'Home', slug: 'home', useGlobalHeader: true, useGlobalFooter: footer }],
        currentPageId: 'pg-1',
        globalHeaderId: 'head-1',
        nodes: GLOBAL_NODES,
      } as never);
      const container = document.createElement('div');
      document.body.appendChild(container);
      act(() => {
        createRoot(container).render(<Canvas page={GLOBAL_NODES['page-1']!} nodes={GLOBAL_NODES} breakpoint="desktop" />);
      });
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      act(() => { iframe.dispatchEvent(new Event('load')); });
      return iframe.contentDocument!;
    }

    function bodyText(doc: Document): string {
      return doc.body ? doc.body.textContent ?? '' : '';
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.unstubAllGlobals();
    });

    it('shows the global header banner when a header descendant is selected', () => {
      useEditorStore.getState().setSelection(['h-1']);
      const doc = renderCanvas();
      expect(bodyText(doc)).toContain('Editing global header – changes apply to all pages');
      expect(doc.querySelector('[data-node-id="head-1"]')).not.toBeNull();
      expect(doc.querySelector('[data-node-id="h-1"]')).not.toBeNull();
    });

    it('shows the footer banner when a footer descendant is selected', () => {
      useEditorStore.setState({ globalFooterId: 'foot-1', selection: ['fp-1'] });
      const doc = renderCanvas(true);
      expect(bodyText(doc)).toContain('Editing global footer – changes apply to all pages');
    });

    it('shows no banner when a regular page node is selected', () => {
      useEditorStore.getState().setSelection(['box-1']);
      const doc = renderCanvas();
      expect(bodyText(doc)).not.toContain('Editing global');
      expect(bodyText(doc)).not.toContain('changes apply to all pages');
    });

    it('shows no banner when nothing is selected', () => {
      useEditorStore.getState().setSelection([]);
      const doc = renderCanvas();
      expect(bodyText(doc)).not.toContain('Editing global');
    });
  });
});
