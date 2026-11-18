// src/components/SeoPanel.test.tsx
// SEO panel: renders a row per page; blurring title/slug/meta description
// inputs updates the store page's fields via renamePage / updatePage.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import type { Node, NodeId } from '../types';
import { emptyEditorData } from '../types';
import SeoPanel from './SeoPanel';

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

function renderSeo(pages: { id: NodeId; title: string; slug: string }[]) {
  useEditorStore.setState({
    ...emptyEditorData(),
    pages: pages.map((p) => ({ ...p, rootId: p.id, useGlobalHeader: true, useGlobalFooter: true })),
    nodes: Object.fromEntries(pages.map((p) => [p.id, pageNode(p.id)])),
    currentPageId: pages[0]?.id ?? null,
    history: [],
    historyIndex: -1,
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<SeoPanel />);
  });
  return container;
}

function blurInput(container: HTMLElement, ariaLabel: string, value: string) {
  const input = container.querySelector(`input[aria-label="${ariaLabel}"]`) as HTMLInputElement | null;
  if (!input) throw new Error(`no input for ${ariaLabel}`);
  act(() => {
    input.focus();
    input.value = value;
    input.blur();
  });
}

function blurTextarea(container: HTMLElement, ariaLabel: string, value: string) {
  const textarea = container.querySelector(
    `textarea[aria-label="${ariaLabel}"]`,
  ) as HTMLTextAreaElement | null;
  if (!textarea) throw new Error(`no textarea for ${ariaLabel}`);
  act(() => {
    textarea.focus();
    textarea.value = value;
    textarea.blur();
  });
}

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  useEditorStore.setState({
    ...emptyEditorData(),
    selection: [],
    history: [],
    historyIndex: -1,
  });
});

describe('SeoPanel', () => {
  it('renders nothing when the project has no pages', () => {
    const container = renderSeo([]);
    expect(container.textContent).toBe('');
  });

  it('renders a title, slug and meta description row per page', () => {
    const container = renderSeo([
      { id: 'page-1', title: 'Home', slug: 'home' },
      { id: 'page-2', title: 'About', slug: 'about' },
    ]);
    const titles = container.querySelectorAll('input[aria-label="Title"]');
    const slugs = container.querySelectorAll('input[aria-label="Slug"]');
    const descriptions = container.querySelectorAll('textarea[aria-label="Meta description"]');
    expect(titles).toHaveLength(2);
    expect(slugs).toHaveLength(2);
    expect(descriptions).toHaveLength(2);
    expect((titles[0] as HTMLInputElement).value).toBe('Home');
    expect((titles[1] as HTMLInputElement).value).toBe('About');
    expect(container.textContent).toContain('Meta description');
  });

  it('blurring the title input renames the page in the store', () => {
    const container = renderSeo([{ id: 'page-1', title: 'Home', slug: 'home' }]);
    blurInput(container, 'Title', 'About us');
    expect(useEditorStore.getState().pages[0]!.title).toBe('About us');
  });

  it('blurring the slug input updates the page slug in the store', () => {
    const container = renderSeo([{ id: 'page-1', title: 'Home', slug: 'home' }]);
    blurInput(container, 'Slug', 'about-us');
    expect(useEditorStore.getState().pages[0]!.slug).toBe('about-us');
  });

  it('blurring the meta description input updates the page metaDescription in the store', () => {
    const container = renderSeo([{ id: 'page-1', title: 'Home', slug: 'home' }]);
    blurTextarea(container, 'Meta description', 'Welcome to our home page.');
    expect(useEditorStore.getState().pages[0]!.metaDescription).toBe(
      'Welcome to our home page.',
    );
  });

  it('edits one page without touching the others', () => {
    const container = renderSeo([
      { id: 'page-1', title: 'Home', slug: 'home' },
      { id: 'page-2', title: 'About', slug: 'about' },
    ]);
    const slugs = container.querySelectorAll('input[aria-label="Slug"]');
    act(() => {
      const input = slugs[1] as HTMLInputElement;
      input.focus();
      input.value = 'about-us';
      input.blur();
    });
    const pages = useEditorStore.getState().pages;
    expect(pages.find((p) => p.id === 'page-1')!.slug).toBe('home');
    expect(pages.find((p) => p.id === 'page-2')!.slug).toBe('about-us');
  });

  it('blurring with an empty value leaves the field unchanged', () => {
    const container = renderSeo([{ id: 'page-1', title: 'Home', slug: 'home' }]);
    blurInput(container, 'Title', '');
    expect(useEditorStore.getState().pages[0]!.title).toBe('Home');
  });
});
