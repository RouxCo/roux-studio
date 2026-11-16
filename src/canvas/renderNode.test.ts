// src/canvas/renderNode.test.ts
// Renderer tests: canvas vs export mode, responsive style resolution,
// per-element markup, and the length/style helpers (spec §4.4, §7).
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Breakpoint, Node, NodeId } from '../types';
import { lengthToCss, resolveStyles, renderNode, type RenderContext } from './renderNode';

const PAGE: Node = {
  id: 'page-1', type: 'page', parentId: null, children: ['sec-1'], styles: {}, hidden: {}, locked: false,
  title: 'Home', slug: 'home', backgroundLayers: [],
};
const SECTION: Node = {
  id: 'sec-1', type: 'section', parentId: 'page-1', children: ['box-1'], styles: {
    width: {
      desktop: { kind: 'px', value: 1440 },
      tablet: { kind: 'px', value: 768 },
      mobile: { kind: 'px', value: 390 },
    },
  }, hidden: {}, locked: false,
  backgroundLayers: [],
  sectionBlend: { enabled: false, feather: 0, overlap: 0 },
};
const BOX: Node = {
  id: 'box-1', type: 'box', parentId: 'sec-1', children: ['h-1', 'p-1', 'btn-1', 'img-1', 'icon-1'], styles: {
    display: { desktop: 'flex' },
    padding: { desktop: { kind: 'px', value: 16 } },
  }, hidden: {}, locked: false,
};
const H2: Node = {
  id: 'h-1', type: 'heading', parentId: 'box-1', children: [], styles: {
    color: { desktop: '#0f766e', mobile: '#e2e8f0' },
  }, hidden: { mobile: true }, locked: false, level: 2, text: 'Roux and Co.',
};
const P: Node = {
  id: 'p-1', type: 'paragraph', parentId: 'box-1', children: [], styles: {
    fontSize: { desktop: { kind: 'px', value: 16 }, mobile: { kind: 'px', value: 14 } },
  }, hidden: {}, locked: false, text: 'We build websites that work.',
};
const BTN: Node = {
  id: 'btn-1', type: 'button', parentId: 'box-1', children: [], styles: {
    width: { desktop: { kind: 'pct', value: 100 }, mobile: { kind: 'pct', value: 50 } },
    marginTop: { desktop: { kind: 'px', value: 8 } },
  }, hidden: {}, locked: false, text: 'Get in touch',
};
const LINK: Node = {
  id: 'link-1', type: 'link', parentId: 'box-1', children: [], styles: {}, hidden: {}, locked: false,
  href: '/work', text: 'See our work',
};
const IMG: Node = {
  id: 'img-1', type: 'image', parentId: 'box-1', children: [], styles: {
    width: { desktop: { kind: 'px', value: 200 } },
  }, hidden: {}, locked: false, src: 'assets/logo.svg', alt: 'Roux logo',
};
const ICON: Node = {
  id: 'icon-1', type: 'icon', parentId: 'box-1', children: [], styles: {
    width: { desktop: { kind: 'px', value: 24 } },
    height: { desktop: { kind: 'px', value: 24 } },
  }, hidden: {}, locked: false, name: 'Menu',
};
const TREE: Record<NodeId, Node> = {
  [PAGE.id]: PAGE, [SECTION.id]: SECTION, [BOX.id]: BOX, [H2.id]: H2, [P.id]: P,
  [BTN.id]: BTN, [LINK.id]: LINK, [IMG.id]: IMG, [ICON.id]: ICON,
};

function render(id: NodeId, bp: Breakpoint = 'desktop', mode: 'canvas' | 'export' = 'canvas'): string {
  const node = TREE[id];
  if (!node) throw new Error(`renderNode test: no node ${id} in fixture tree`);
  const ctx: RenderContext = { mode, breakpoint: bp, nodes: TREE };
  return renderToStaticMarkup(renderNode(node, ctx));
}

function treeWithout(idToDrop: NodeId): Record<NodeId, Node> {
  const tree = { ...TREE };
  delete tree[idToDrop];
  return tree;
}

function renderWithNodes(
  rootId: NodeId, nodes: Record<NodeId, Node>, bp: Breakpoint = 'desktop', mode: 'canvas' | 'export' = 'canvas',
): string {
  const node = nodes[rootId];
  if (!node) throw new Error(`renderNode test: no node ${rootId} in tree`);
  const ctx: RenderContext = { mode, breakpoint: bp, nodes };
  return renderToStaticMarkup(renderNode(node, ctx));
}

describe('renderNode — canvas vs export mode', () => {
  it('puts data-node-id on every rendered element in canvas mode', () => {
    const html = render('page-1');
    expect(html).toContain('data-node-id="page-1"');
    expect(html).toContain('data-node-id="sec-1"');
    expect(html).toContain('data-node-id="box-1"');
    expect(html).toContain('data-node-id="h-1"');
    expect(html).toContain('data-node-id="btn-1"');
    expect(html).toContain('data-node-id="img-1"');
    expect(html).toContain('data-node-id="icon-1"');
  });

  it('omits data-node-id in export mode', () => {
    const html = render('page-1', 'desktop', 'export');
    expect(html).not.toContain('data-node-id');
    expect(html).toContain('<section');
    expect(html).toMatch(/<h2[^>]*>Roux and Co\.<\/h2>/);
    expect(html).toMatch(/<p[^>]*>We build websites that work\.<\/p>/);
  });

  it('renders the correct HTML element per type', () => {
    expect(render('sec-1')).toContain('<section');
    expect(render('box-1')).toContain('<div');
    expect(render('h-1', 'desktop', 'export')).toMatch(/<h2[^>]*>/);
    expect(render('p-1', 'desktop', 'export')).toMatch(/<p[^>]*>/);
    expect(render('btn-1', 'desktop', 'export')).toMatch(/<button[^>]*>Get in touch<\/button>/);
    expect(render('link-1', 'desktop', 'export')).toMatch(/<a class="r-[0-9a-f]+" href="\/work">See our work<\/a>/);
    expect(render('img-1', 'desktop', 'export')).toContain('<img src="assets/logo.svg" alt="Roux logo"');
  });

  it('renders the inline edit branch for a heading in canvas mode when editing', () => {
    const onStartEditing = vi.fn();
    const onSaveText = vi.fn();
    const html = renderToStaticMarkup(
      renderNode(H2, {
        mode: 'canvas',
        breakpoint: 'desktop',
        nodes: TREE,
        editingNodeId: 'h-1',
        onStartEditing,
        onSaveText,
      }),
    );
    expect(html).toContain('Roux and Co.');
    expect(html).toContain('<h2');
  });

  it('keeps double-click editing out of export mode', () => {
    const html = renderToStaticMarkup(
      renderNode(H2, {
        mode: 'export',
        breakpoint: 'desktop',
        nodes: TREE,
        editingNodeId: 'h-1',
        onStartEditing: vi.fn(),
        onSaveText: vi.fn(),
      }),
    );
    expect(html).toMatch(/<h2[^>]*>Roux and Co\.<\/h2>/);
    expect(html).not.toMatch(/data-editing/);
  });

  it('maps heading level to h1 through h6', () => {
    for (const level of [1, 2, 3, 4, 5, 6] as (1 | 2 | 3 | 4 | 5 | 6)[]) {
      const node: Node = {
        id: `h-${level}`, type: 'heading', parentId: 'box-1', children: [], styles: {},
        hidden: {}, locked: false, level, text: `L${level}`,
      };
      const html = renderToStaticMarkup(
        renderNode(node, { mode: 'export', breakpoint: 'desktop', nodes: { [node.id]: node } }),
      );
      expect(html).toMatch(new RegExp(`<h${level} class="r-[0-9a-f]+">L${level}</h${level}>`));
    }
  });

  it('renders an unknown lucide icon name as a fallback svg', () => {
    const node: Node = {
      id: 'icon-2', type: 'icon', parentId: 'box-1', children: [], styles: {},
      hidden: {}, locked: false, name: 'DoesNotExist',
    };
    const html = renderToStaticMarkup(
      renderNode(node, { mode: 'export', breakpoint: 'desktop', nodes: { [node.id]: node } }),
    );
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 24 24"');
  });

  it('renders nested children recursively', () => {
    const html = render('page-1');
    expect(html.indexOf('<section')).toBeLessThan(html.indexOf('<h2'));
    expect(html.indexOf('<h2')).toBeLessThan(html.indexOf('</section>'));
  });

  it('renders nothing for a child id missing from the nodes map instead of throwing', () => {
    const html = renderWithNodes('box-1', treeWithout('h-1'));
    expect(html).toContain('<div');
    expect(html).not.toContain('Roux and Co.');
  });
});

describe('resolveStyles — responsive resolution (desktop-first)', () => {
  const base = { width: { desktop: { kind: 'px', value: 1440 } } };

  it('uses the desktop value at desktop breakpoint', () => {
    const style = resolveStyles(base as any, 'desktop');
    expect(style.width).toBe('1440px');
  });

  it('uses the tablet override at tablet, falling back to desktop when unset', () => {
    const style = resolveStyles(
      { width: { desktop: { kind: 'px', value: 1440 }, tablet: { kind: 'px', value: 768 } } } as any,
      'tablet',
    );
    expect(style.width).toBe('768px');
  });

  it('uses the mobile override at mobile, winning over tablet and desktop', () => {
    const style = resolveStyles(
      {
        width: {
          desktop: { kind: 'px', value: 1440 },
          tablet: { kind: 'px', value: 768 },
          mobile: { kind: 'px', value: 390 },
        },
      } as any,
      'mobile',
    );
    expect(style.width).toBe('390px');
  });

  it('falls back to desktop at mobile when mobile is unset', () => {
    const style = resolveStyles(
      { width: { desktop: { kind: 'px', value: 1440 }, tablet: { kind: 'px', value: 768 } } } as any,
      'mobile',
    );
    expect(style.width).toBe('1440px');
  });

  it('captures resolved styles in an r-{hash} class at each breakpoint', () => {
    expect(render('sec-1', 'desktop')).toMatch(/<div[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
    expect(render('sec-1', 'tablet')).toMatch(/<div[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
    expect(render('sec-1', 'mobile')).toMatch(/<div[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
  });

  it('renders hidden nodes with an r-{hash} class and no inline style at any breakpoint', () => {
    expect(render('h-1', 'desktop')).toMatch(/<h2[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
    expect(render('h-1', 'mobile')).toMatch(/<h2[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
    expect(render('h-1', 'desktop')).not.toMatch(/style=/);
    expect(render('h-1', 'mobile')).not.toMatch(/style=/);
  });

  it('renders typography nodes with an r-{hash} class and no inline style at each breakpoint', () => {
    expect(render('p-1', 'desktop')).toMatch(/<p[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
    expect(render('p-1', 'mobile')).toMatch(/<p[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
    expect(render('p-1', 'desktop')).not.toMatch(/style=/);
    expect(render('p-1', 'mobile')).not.toMatch(/style=/);
  });

  it('renders percentage-width nodes with an r-{hash} class and no inline style at each breakpoint', () => {
    expect(render('btn-1', 'desktop')).toMatch(/<button[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
    expect(render('btn-1', 'mobile')).toMatch(/<button[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
    expect(render('btn-1', 'desktop')).not.toMatch(/style=/);
    expect(render('btn-1', 'mobile')).not.toMatch(/style=/);
  });

  it('resolves token lengths to var(--...) references', () => {
    const style = resolveStyles(
      { width: { desktop: { kind: 'token', value: 0, token: 'space-4' } } } as any,
      'desktop',
    );
    expect(style.width).toBe('var(--space-4)');
  });
});

describe('lengthToCss', () => {
  it('converts px, rem, pct, vh, vw, em and token lengths', () => {
    expect(lengthToCss({ kind: 'px', value: 8 })).toBe('8px');
    expect(lengthToCss({ kind: 'rem', value: 1.5 })).toBe('1.5rem');
    expect(lengthToCss({ kind: 'pct', value: 50 })).toBe('50%');
    expect(lengthToCss({ kind: 'vh', value: 100 })).toBe('100vh');
    expect(lengthToCss({ kind: 'vw', value: 50 })).toBe('50vw');
    expect(lengthToCss({ kind: 'em', value: 2 })).toBe('2em');
    expect(lengthToCss({ kind: 'token', value: 0, token: 'space-4' })).toBe('var(--space-4)');
    expect(lengthToCss('auto')).toBe('auto');
    expect(lengthToCss('none')).toBe('none');
  });

  describe('renderNode — export mode never emits inline styles', () => {
    it('emits an r-{hash} class name and no style attribute on styled elements in export mode', () => {
      const html = render('box-1', 'desktop', 'export');
      expect(html).toMatch(/<div[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
      expect(html).not.toMatch(/style=/);
    });

    it('emits an r-{hash} class name and no inline style in canvas mode', () => {
      const html = render('box-1', 'desktop', 'canvas');
      expect(html).toMatch(/<div[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
      expect(html).not.toMatch(/style=/);
    });

    it('canvas mode nodes carry their r-{hash} class', () => {
      const html = render('h-1', 'desktop', 'canvas');
      expect(html).toMatch(/<h2[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
    });

    it('export mode nodes carry their r-{hash} class too', () => {
      const html = render('h-1', 'desktop', 'export');
      expect(html).toMatch(/<h2[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
    });

    it('classes come from the node ID, not the style: same ID repeats, different IDs differ', () => {
      const styled: Node = {
        id: 'n', type: 'box', parentId: null, children: [], styles: { color: { desktop: '#0f766e' } },
        hidden: {}, locked: false,
      };
      const sameIdAgain = { ...styled, id: 'n' };
      const otherIdSameStyle = { ...styled, id: 'm' };
      const ctx = (id: string, node: Node): RenderContext => ({
        mode: 'export', breakpoint: 'desktop', nodes: { [id]: node },
      });
      const classOf = (node: Node): string => {
        const html = renderToStaticMarkup(renderNode(node, ctx(node.id, node)));
        const match = html.match(/class="([^"]+)"/);
        if (!match) throw new Error(`no class attribute in ${html}`);
        return match[1]!;
      };
      const first = classOf(styled);
      expect(first).toMatch(/^r-[a-f0-9]{6,}$/);
      // same node ID renders the same class every time
      expect(classOf(sameIdAgain)).toBe(first);
      // different node ID renders a different class even with identical styles
      expect(classOf(otherIdSameStyle)).not.toBe(first);
    });

    it('hides via the r-{hash} class instead of inline style in export mode', () => {
      const html = render('h-1', 'mobile', 'export');
      expect(html).toMatch(/<h2[^>]*class="r-[a-f0-9]{6,}"[^>]*>/);
      expect(html).not.toMatch(/style=/);
    });

    it('emits no style attribute in export mode', () => {
      const html = render('link-1', 'desktop', 'export');
      expect(html).toMatch(/<a[^>]*href="\/work"[^>]*>/);
      expect(html).not.toMatch(/style=/);
      expect(html).toMatch(/class="r-[0-9a-f]+"/);
    });
  });
});
