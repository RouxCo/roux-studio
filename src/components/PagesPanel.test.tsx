// src/components/PagesPanel.test.tsx
// Pages panel: lists pages, switches the current page, adds, renames and deletes.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import type { Node, NodeId } from '../types';
import { emptyEditorData } from '../types';
import PagesPanel from './PagesPanel';

let root!: ReturnType<typeof createRoot>;

function pageNode(id: NodeId): Node {
  return {
    id,
    type: 'page',
    parentId: null,
    children: [],
    styles: {},
    hidden: {},
    locked: false,
    title: 'Page',
    slug: id,
    backgroundLayers: [],
  };
}

function renderPages(
  pages: { id: NodeId; title: string; slug: string }[],
  current: NodeId | null,
) {
  useEditorStore.setState({
    ...emptyEditorData(),
    pages: pages.map((p) => ({ ...p, rootId: p.id, useGlobalHeader: true, useGlobalFooter: true })),
    nodes: Object.fromEntries(pages.map((p) => [p.id, pageNode(p.id)])),
    currentPageId: current,
    history: [],
    historyIndex: -1,
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<PagesPanel />);
  });
  return container;
}

function pageRow(container: HTMLElement, title: string): HTMLElement {
  const titleEl = Array.from(container.querySelectorAll('span')).find(
    (s) => s.textContent === title && !s.querySelector('input') && !s.closest('p'),
  );
  if (!titleEl) throw new Error(`no page row for ${title}`);
  const row = titleEl.parentElement as HTMLElement | null;
  if (!row) throw new Error(`no row div for ${title}`);
  return row;
}

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  useEditorStore.setState({
    ...emptyEditorData(),
    selection: [],
    history: [],
    historyIndex: -1,
  });
});

describe('PagesPanel', () => {
  it('renders every page title', () => {
    const container = renderPages(
      [
        { id: 'page-1', title: 'Home', slug: 'home' },
        { id: 'page-2', title: 'About', slug: 'about' },
      ],
      'page-1',
    );
    expect(container.textContent).toContain('Home');
    expect(container.textContent).toContain('About');
  });

  it('highlights the current page with aria-current="page"', () => {
    const container = renderPages(
      [
        { id: 'page-1', title: 'Home', slug: 'home' },
        { id: 'page-2', title: 'About', slug: 'about' },
      ],
      'page-2',
    );
    const current = container.querySelector('[aria-current="page"]');
    expect(current).not.toBeNull();
    expect(current?.textContent).toContain('About');
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it('clicking a page row sets it current', () => {
    const container = renderPages(
      [
        { id: 'page-1', title: 'Home', slug: 'home' },
        { id: 'page-2', title: 'About', slug: 'about' },
      ],
      'page-1',
    );
    act(() => pageRow(container, 'About').click());
    expect(useEditorStore.getState().currentPageId).toBe('page-2');
  });

  it('"New page" adds a row and makes it current', () => {
    const container = renderPages(
      [{ id: 'page-1', title: 'Home', slug: 'home' }],
      'page-1',
    );
    act(() => {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'New page',
      );
      btn!.click();
    });
    const pages = useEditorStore.getState().pages;
    expect(pages).toHaveLength(2);
    expect(pages[1]!.title).toMatch(/^Page \d+$/);
    expect(useEditorStore.getState().currentPageId).toBe(pages[1]!.id);
    expect(container.textContent).toMatch(/Page \d+/);
  });

  it('rename commits through the store on Enter', () => {
    const container = renderPages(
      [{ id: 'page-1', title: 'Home', slug: 'home' }],
      'page-1',
    );
    act(() => {
      const btn = pageRow(container, 'Home').querySelector(
        'button[aria-label="Rename page"]',
      ) as HTMLButtonElement;
      btn.click();
    });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();
    act(() => {
      input!.value = 'About';
      input!.dispatchEvent(new InputEvent('input', { bubbles: true }));
      input!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });
    expect(useEditorStore.getState().pages[0]!.title).toBe('About');
    expect(container.textContent).toContain('About');
    expect(container.textContent).not.toContain('Home');
    expect(container.querySelector('input')).toBeNull();
  });

  it('rename Escape cancels and leaves the title unchanged', () => {
    const container = renderPages(
      [{ id: 'page-1', title: 'Home', slug: 'home' }],
      'page-1',
    );
    act(() => {
      const btn = pageRow(container, 'Home').querySelector(
        'button[aria-label="Rename page"]',
      ) as HTMLButtonElement;
      btn.click();
    });
    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      input!.value = 'Nope';
      input!.dispatchEvent(new InputEvent('input', { bubbles: true }));
      input!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });
    expect(useEditorStore.getState().pages[0]!.title).toBe('Home');
    expect(container.querySelector('input')).toBeNull();
    expect(container.textContent).toContain('Home');
  });

  it('delete button is disabled with one page and cannot remove it', () => {
    const container = renderPages(
      [{ id: 'page-1', title: 'Home', slug: 'home' }],
      'page-1',
    );
    const btn = pageRow(container, 'Home').querySelector(
      'button[aria-label="Delete page"]',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    act(() => btn.click());
    expect(useEditorStore.getState().pages).toHaveLength(1);
    expect(container.textContent).toContain('Home');
  });

  it('deleting one of two pages removes the row', () => {
    const container = renderPages(
      [
        { id: 'page-1', title: 'Home', slug: 'home' },
        { id: 'page-2', title: 'About', slug: 'about' },
      ],
      'page-1',
    );
    act(() => {
      const btn = pageRow(container, 'About').querySelector(
        'button[aria-label="Delete page"]',
      ) as HTMLButtonElement;
      btn.click();
    });
    const state = useEditorStore.getState();
    expect(state.pages).toHaveLength(1);
    expect(state.pages[0]!.title).toBe('Home');
    expect(container.textContent).not.toContain('About');
  });

  it('deleting the current page switches to the remaining page', () => {
    const container = renderPages(
      [
        { id: 'page-1', title: 'Home', slug: 'home' },
        { id: 'page-2', title: 'About', slug: 'about' },
      ],
      'page-1',
    );
    act(() => {
      const btn = pageRow(container, 'Home').querySelector(
        'button[aria-label="Delete page"]',
      ) as HTMLButtonElement;
      btn.click();
    });
    expect(useEditorStore.getState().currentPageId).toBe('page-2');
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('About');
  });
});
