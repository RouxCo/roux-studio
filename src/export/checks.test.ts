// src/export/checks.test.ts
// Tests for runPreExportChecks: errors (no title, duplicate slugs) and
// warnings (images without alt, H1 count, heading skips, accessible name,
// text size, contrast, font family, meta description) (spec §11.5).
import { describe, expect, it } from 'vitest';
import type { Node, PageId, Project } from '../types';
import { runPreExportChecks } from './checks';

function page(id: PageId, rootId: string, title = 'Home', slug?: string): Project['pages'][number] {
  return { id, title, slug: slug ?? id, rootId };
}

function project(pages: Project['pages']): Project {
  return {
    id: 'proj-1',
    name: 'Roux Studio',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    pages,
    tokens: { byName: {} },
    blocks: [],
    globalHeaderId: null,
    globalFooterId: null,
  };
}

const ROOT = 'page-1';
const SEC = 'sec-1';
const H = 'h-1';
const IMG = 'img-1';
const LNK = 'lnk-1';
const BTN = 'btn-1';

function baseTree(): Record<string, Node> {
  return {
    [ROOT]: {
      id: ROOT, type: 'page', parentId: null, children: [SEC], styles: {}, hidden: {}, locked: false,
      title: 'Home', slug: 'home', backgroundLayers: [],
    },
    [SEC]: {
      id: SEC, type: 'section', parentId: ROOT, children: [H, IMG, LNK, BTN], styles: {}, hidden: {}, locked: false,
      backgroundLayers: [], sectionBlend: { enabled: false, feather: 0, overlap: 0 },
    },
    [H]: {
      id: H, type: 'heading', parentId: SEC, children: [], styles: {}, hidden: {}, locked: false,
      level: 1, text: 'Welcome',
    },
    [IMG]: {
      id: IMG, type: 'image', parentId: SEC, children: [], styles: {}, hidden: {}, locked: false,
      src: 'logo.png', alt: '',
    },
    [LNK]: {
      id: LNK, type: 'link', parentId: SEC, children: [], styles: {}, hidden: {}, locked: false,
      href: '/work', text: '',
    },
    [BTN]: {
      id: BTN, type: 'button', parentId: SEC, children: [], styles: {}, hidden: {}, locked: false,
      text: '',
    },
  } as Record<string, Node>;
}

function addNode(tree: Record<string, Node>, node: Node): Record<string, Node> {
  const sec = tree[SEC]!;
  return {
    ...tree,
    [SEC]: { ...sec, children: [...sec.children, node.id] },
    [node.id]: node,
  };
}

describe('runPreExportChecks', () => {
  it('returns no errors or warnings for a clean project', () => {
    const cleanTree: Record<string, Node> = {
      ...baseTree(),
      [H]: { ...baseTree()[H]!, styles: { fontFamily: { desktop: 'Inter' } } } as Node,
      [IMG]: { ...baseTree()[IMG]!, alt: 'Roux logo' } as Node,
      [LNK]: { ...baseTree()[LNK]!, styles: { fontFamily: { desktop: 'Inter' } }, text: 'See our work' } as Node,
      [BTN]: { ...baseTree()[BTN]!, styles: { fontFamily: { desktop: 'Inter' } }, text: 'Get in touch' } as Node,
    };
    const p = project([
      { ...page('pg-1', ROOT), metaDescription: 'Roux Studio builds distinctive websites for independent brands.' },
    ]);
    const result = runPreExportChecks(p, cleanTree);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('errors on a page with no title', () => {
    const p = project([{ ...page('pg-1', ROOT), title: '' }]);
    const result = runPreExportChecks(p, baseTree());
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.type).toBe('error');
    expect(result.errors[0]!.nodeId).toBeNull();
  });

  it('errors on duplicate slugs', () => {
    const p = project([page('pg-1', ROOT, 'Home', 'home'), page('pg-2', ROOT, 'About', 'home')]);
    const result = runPreExportChecks(p, baseTree());
    const dup = result.errors.find((e) => e.id === 'duplicate-slug');
    expect(dup).toBeDefined();
    expect(dup!.type).toBe('error');
    expect(dup!.nodeId).toBeNull();
  });

  it('warns on an image without alt', () => {
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), baseTree());
    const warn = result.warnings.find((w) => w.id === 'image-no-alt');
    expect(warn).toBeDefined();
    expect(warn!.nodeId).toBe(IMG);
  });

  it('warns on a page with no H1', () => {
    const noH1: Record<string, Node> = {
      ...baseTree(),
      [H]: { ...baseTree()[H]!, type: 'paragraph', text: 'Not a heading' } as Node,
    };
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), noH1);
    const warn = result.warnings.find((w) => w.id === 'zero-h1');
    expect(warn).toBeDefined();
    expect(warn!.nodeId).toBeNull();
  });

  it('warns on multiple H1s', () => {
    const twoH1: Record<string, Node> = {
      ...baseTree(),
      [IMG]: { ...baseTree()[H]!, id: 'h-2', type: 'heading', level: 1, text: 'Second H1' } as Node,
    };
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), twoH1);
    const warn = result.warnings.find((w) => w.id === 'multiple-h1');
    expect(warn).toBeDefined();
    expect(warn!.nodeId).toBeNull();
  });

  it('warns on a heading-level skip', () => {
    const skip: Record<string, Node> = {
      ...baseTree(),
      [H]: { ...baseTree()[H]!, level: 2 } as Node,
      [IMG]: { ...baseTree()[H]!, id: 'h-2', type: 'heading', level: 4, text: 'Deep heading' } as Node,
    };
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), skip);
    const warn = result.warnings.find((w) => w.id === 'heading-skip');
    expect(warn).toBeDefined();
    expect(warn!.nodeId).toBe('h-2');
  });

  it('warns on a link with no accessible name', () => {
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), baseTree());
    const warn = result.warnings.find((w) => w.id === 'no-accessible-name' && w.nodeId === LNK);
    expect(warn).toBeDefined();
    expect(warn!.type).toBe('warning');
  });

  it('warns on a button with no accessible name', () => {
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), baseTree());
    const warn = result.warnings.find((w) => w.id === 'no-accessible-name' && w.nodeId === BTN);
    expect(warn).toBeDefined();
    expect(warn!.type).toBe('warning');
  });

  it('carries the offending nodeId on node-level items', () => {
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), baseTree());
    const imgWarn = result.warnings.find((w) => w.id === 'image-no-alt');
    expect(imgWarn!.nodeId).toBe(IMG);
  });

  it('warns when body text is smaller than 16px', () => {
    const tree = addNode(baseTree(), {
      id: 'para-1',
      type: 'paragraph',
      parentId: SEC,
      children: [],
      styles: { fontFamily: { desktop: 'Inter' }, fontSize: { desktop: { kind: 'px', value: 14 } } },
      hidden: {},
      locked: false,
      text: 'Small print.',
    });
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), tree);
    const warn = result.warnings.find((w) => w.id === 'text-size-too-small' && w.nodeId === 'para-1');
    expect(warn).toBeDefined();
    expect(warn!.type).toBe('warning');
  });

  it('does not warn when body text is 16px or larger', () => {
    const tree = addNode(baseTree(), {
      id: 'para-1',
      type: 'paragraph',
      parentId: SEC,
      children: [],
      styles: { fontFamily: { desktop: 'Inter' }, fontSize: { desktop: { kind: 'rem', value: 1 } } },
      hidden: {},
      locked: false,
      text: 'Body text.',
    });
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), tree);
    expect(result.warnings.find((w) => w.id === 'text-size-too-small')).toBeUndefined();
  });

  it('warns when text contrast is below 4.5:1', () => {
    const tree = addNode(baseTree(), {
      id: 'h-2',
      type: 'heading',
      parentId: SEC,
      children: [],
      styles: { fontFamily: { desktop: 'Inter' }, color: { desktop: '#777777' }, backgroundColor: { desktop: '#ffffff' } },
      hidden: {},
      locked: false,
      level: 2,
      text: 'Faint heading',
    });
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), tree);
    const warn = result.warnings.find((w) => w.id === 'low-contrast' && w.nodeId === 'h-2');
    expect(warn).toBeDefined();
    expect(warn!.type).toBe('warning');
  });

  it('does not warn when text contrast meets 4.5:1', () => {
    const tree = addNode(baseTree(), {
      id: 'h-2',
      type: 'heading',
      parentId: SEC,
      children: [],
      styles: { fontFamily: { desktop: 'Inter' }, color: { desktop: '#111111' }, backgroundColor: { desktop: '#ffffff' } },
      hidden: {},
      locked: false,
      level: 2,
      text: 'Dark heading',
    });
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), tree);
    expect(result.warnings.find((w) => w.id === 'low-contrast')).toBeUndefined();
  });

  it('warns when a text node has no font family', () => {
    const tree = addNode(baseTree(), {
      id: 'para-2',
      type: 'paragraph',
      parentId: SEC,
      children: [],
      styles: {},
      hidden: {},
      locked: false,
      text: 'Plain paragraph',
    });
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), tree);
    const warn = result.warnings.find((w) => w.id === 'missing-font' && w.nodeId === 'para-2');
    expect(warn).toBeDefined();
    expect(warn!.type).toBe('warning');
  });

  it('warns when a page has no meta description', () => {
    const result = runPreExportChecks(project([page('pg-1', ROOT)]), baseTree());
    const warn = result.warnings.find((w) => w.id === 'meta-description-missing');
    expect(warn).toBeDefined();
    expect(warn!.type).toBe('warning');
    expect(warn!.nodeId).toBeNull();
  });

  it('warns when a page meta description is too short', () => {
    const p = project([{ ...page('pg-1', ROOT), metaDescription: 'Too short' }]);
    const result = runPreExportChecks(p, baseTree());
    const warn = result.warnings.find((w) => w.id === 'meta-description-too-short');
    expect(warn).toBeDefined();
    expect(warn!.type).toBe('warning');
    expect(warn!.nodeId).toBeNull();
  });

  it('warns when a page meta description is too long', () => {
    const p = project([{ ...page('pg-1', ROOT), metaDescription: 'x'.repeat(161) }]);
    const result = runPreExportChecks(p, baseTree());
    const warn = result.warnings.find((w) => w.id === 'meta-description-too-long');
    expect(warn).toBeDefined();
    expect(warn!.type).toBe('warning');
    expect(warn!.nodeId).toBeNull();
  });
});
