// src/compile/compileStyles.test.ts
// Tests for compileStyles: :root token variables, base styles, per-node
// r-<hash> rules with desktop/base and breakpoint-only media queries, hidden,
// length serialisation and kebab-case keys. Pure: no React/store/DOM.
import { describe, expect, it } from 'vitest';
import type { BackgroundLayer, Node, PageId, Project } from '../types';
import { compileStyles } from './compileStyles';
import { useEditorStore } from '../store/useEditorStore';

function page(id: PageId, rootId: string, title = 'Home'): Project['pages'][number] {
  return { id, title, slug: id, rootId };
}

function token(name: string, value: string, type: Project['tokens']['byName'][string]['type'] = 'color') {
  return { name, value, type };
}

function project(pages: Project['pages'], tokens: Record<string, Project['tokens']['byName'][string]>): Project {
  return {
    id: 'proj-1',
    name: 'Roux Studio',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    pages,
    tokens: { byName: tokens },
  };
}

const ROOT = 'page-1';
const SEC = 'sec-1';
const BOX = 'box-1';
const H = 'h-1';
const P = 'p-1';

const TREE: Record<string, Node> = {
  [ROOT]: {
    id: ROOT, type: 'page', parentId: null, children: [SEC], styles: {}, hidden: {}, locked: false,
    title: 'Home', slug: 'home', backgroundLayers: [],
  },
  [SEC]: {
    id: SEC, type: 'section', parentId: ROOT, children: [BOX], styles: {}, hidden: {}, locked: false,
    backgroundLayers: [], sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  },
  [BOX]: {
    id: BOX, type: 'box', parentId: SEC, children: [H, P], styles: {
      display: { desktop: 'flex' },
      padding: { desktop: { kind: 'px', value: 16 } },
      marginTop: { desktop: { kind: 'px', value: 8 }, tablet: { kind: 'px', value: 4 } },
    }, hidden: {}, locked: false,
  },
  [H]: {
    id: H, type: 'heading', parentId: BOX, children: [], styles: {
      color: { desktop: '#0f766e', mobile: '#e2e8f0' },
      fontSize: { desktop: { kind: 'px', value: 20 }, mobile: { kind: 'px', value: 16 } },
    }, hidden: { mobile: true }, locked: false, level: 2, text: 'Roux and Co.',
  },
  [P]: {
    id: P, type: 'paragraph', parentId: BOX, children: [], styles: {
      fontSize: { desktop: { kind: 'px', value: 16 }, mobile: { kind: 'px', value: 14 } },
    }, hidden: {}, locked: false, text: 'We build websites that work.',
  },
};

function mkProject(_tree: Record<string, Node>, tokens: Record<string, Project['tokens']['byName'][string]> = {}): Project {
  return project([page('pg-1', ROOT)], tokens);
}

// Extract every `@media (max-width: 767px)` block, each looking like
// `@media (max-width: 767px) {\n.r-<hash> {\n  <decl>;\n}`.
function mobileBlocks(out: string): RegExpMatchArray | null {
  return out.match(/@media \(max-width: 767px\) \{\n\.r-[a-f0-9]{6,} \{\n[\s\S]*?\n\}/g);
}

function blockFor(blocks: RegExpMatchArray | null, nodeId: string): string {
  const cls = classFor(nodeId);
  return (blocks || []).find((b) => b.includes(cls))!;
}

describe('compileStyles', () => {
  it('returns empty string for a missing page id', () => {
    const p = mkProject(TREE);
    expect(compileStyles(p, 'nope' as PageId, TREE)).toBe('');
  });

  it('returns empty string when the page root node is missing', () => {
    const p = project([page('pg-1', 'missing')], {});
    expect(compileStyles(p, 'pg-1', TREE)).toBe('');
  });

  it('emits :root token variables sorted by name', () => {
    const p = project([page('pg-1', ROOT)], {
      'color-primary': token('color-primary', '#0f766e', 'color'),
      'space-4': token('space-4', '1rem', 'spacing'),
    });
    const out = compileStyles(p, 'pg-1', TREE);
    expect(out).toContain(':root {');
    expect(out).toContain('--color-primary: #0f766e;');
    expect(out).toContain('--space-4: 1rem;');
    // sorted: color-primary before space-4
    expect(out.indexOf('--color-primary')).toBeLessThan(out.indexOf('--space-4'));
  });

  it('skips :root when there are no tokens', () => {
    const p = mkProject(TREE);
    const out = compileStyles(p, 'pg-1', TREE);
    expect(out).not.toContain(':root');
  });

  it('emits base element styles once at the top', () => {
    const p = mkProject(TREE);
    const out = compileStyles(p, 'pg-1', TREE);
    expect(out).toContain('html { box-sizing: border-box; }');
    expect(out).toContain('body { margin: 0; }');
    expect(out).toContain('img { display: block; max-width: 100%; }');
    // base styles appear only once
    expect(out.split('body { margin: 0; }').length).toBe(2);
  });

  it('emits one r-<hash> rule per node with desktop values in the base rule', () => {
    const p = mkProject(TREE);
    const out = compileStyles(p, 'pg-1', TREE);
    // box-1 desktop values
    const boxRule = out.match(new RegExp(`\\.${classForBox()}\\s*\\{[^}]*\\}`))?.[0];
    expect(boxRule).toContain('display: flex;');
    expect(boxRule).toContain('padding: 16px;');
    // marginTop tablet differs → not in base, only in tablet query
    expect(boxRule).not.toContain('margin-top: 4px;');
    expect(boxRule).toContain('margin-top: 8px;');
  });

  it('tablet media query holds only keys differing from desktop', () => {
    const p = mkProject(TREE);
    const out = compileStyles(p, 'pg-1', TREE);
    const tabletBlock = out.match(/@media \(max-width: 1023px\) \{[\s\S]*?\}/);
    expect(tabletBlock).not.toBeNull();
    expect(tabletBlock![0]).toContain('margin-top: 4px;');
    // padding is unchanged at tablet → not in the tablet query
    expect(tabletBlock![0]).not.toContain('padding: 16px;');
  });

  it('mobile media query holds only keys differing from inherited (tablet ?? desktop)', () => {
    const p = mkProject(TREE);
    const out = compileStyles(p, 'pg-1', TREE);
    const blocks = mobileBlocks(out);
    // H font-size mobile 16px overrides desktop 20px → present in mobile query
    expect(blockFor(blocks, H)).toContain('font-size: 16px;');
    // box-1 margin-top mobile unset → falls back to desktop 8, differs from tablet 4 → present
    expect(blockFor(blocks, BOX)).toContain('margin-top: 8px;');
    // box-1 padding unchanged at mobile → not repeated in mobile query
    expect(blockFor(blocks, BOX)).not.toContain('padding');
  });

  it('hidden at mobile renders display:none only in the mobile query', () => {
    const p = mkProject(TREE);
    const out = compileStyles(p, 'pg-1', TREE);
    const blocks = mobileBlocks(out);
    expect(blockFor(blocks, H)).toContain('display: none;');
    // base rule must not have display:none for h-1 (scope to text before first @media)
    const base = out.split('@media')[0];
    expect(base).not.toMatch(new RegExp(`\\.${classFor(H)}\\s*\\{[^}]*display: ?none`));
  });

  it('hidden at desktop renders display:none in the base rule', () => {
    const hiddenRoot: Record<string, Node> = { ...TREE, [H]: { ...TREE[H], hidden: { desktop: true } } as Node };
    const p = mkProject(hiddenRoot);
    const out = compileStyles(p, 'pg-1', hiddenRoot);
    expect(out).toMatch(new RegExp(`\\.${classFor(H)}\\s*\\{[^}]*display: ?none`));
  });

  it('serialises lengths with at most 3 decimals and no trailing zeros', () => {
    const long: Record<string, Node> = { ...TREE, [BOX]: { ...TREE[BOX], styles: { width: { desktop: { kind: 'px', value: 1.2345 } } } } as Node };
    const p = mkProject(long);
    const out = compileStyles(p, 'pg-1', long);
    expect(out).toContain('width: 1.235px;'); // 1.2345 → 1.235
  });

  it('serialises token lengths to var(--token) references', () => {
    const tok: Record<string, Node> = { ...TREE, [BOX]: { ...TREE[BOX], styles: { width: { desktop: { kind: 'token', value: 0, token: 'space-4' } } } } as Node };
    const p = project([page('pg-1', ROOT)], { 'space-4': token('space-4', '1rem', 'spacing') });
    const out = compileStyles(p, 'pg-1', tok);
    expect(out).toContain('var(--space-4)');
  });

  it('kebab-cases camelCase keys', () => {
    const p = mkProject(TREE);
    const out = compileStyles(p, 'pg-1', TREE);
    expect(out).toContain('margin-top: 8px;');
    expect(out).not.toContain('marginTop:');
  });

  it('does not emit empty media queries', () => {
    const plain: Record<string, Node> = {
      ...TREE,
      [BOX]: { ...TREE[BOX], styles: { display: { desktop: 'flex' } }, children: [] } as Node,
    };
    const p = mkProject(plain);
    const out = compileStyles(p, 'pg-1', plain);
    expect(out).not.toContain('@media');
  });

  it('walks nodes in document order: root before children', () => {
    const p = mkProject(TREE);
    const out = compileStyles(p, 'pg-1', TREE);
    // root and section have empty styles → no rule; box (parent) precedes heading (child)
    expect(out.indexOf(classFor(BOX))).toBeLessThan(out.indexOf(classFor(H)));
  });

  it('skips nodes missing from the tree instead of throwing', () => {
    const missingChild: Record<string, Node> = { ...TREE, [SEC]: { ...TREE[SEC], children: ['ghost'] } as Node };
    const p = mkProject(missingChild);
    expect(() => compileStyles(p, 'pg-1', missingChild)).not.toThrow();
  });

  it('emits no inline style attributes — output is pure CSS classes', () => {
    const p = mkProject(TREE);
    const out = compileStyles(p, 'pg-1', TREE);
    expect(out).not.toMatch(/style=/);
    expect(out).toMatch(/r-[a-f0-9]{6,}/);
  });

  it('reflects updateToken in compiled :root token variables', () => {
    useEditorStore.setState({ tokens: { byName: {} } });
    const get = useEditorStore.getState;
    get().addToken({ name: 'space-4', value: '1rem', type: 'spacing' });
    const before = compileStyles(project([page('pg-1', ROOT)], get().tokens.byName), 'pg-1', TREE);
    expect(before).toContain('--space-4: 1rem;');

    get().updateToken('space-4', '2rem');
    const after = compileStyles(project([page('pg-1', ROOT)], get().tokens.byName), 'pg-1', TREE);
    expect(after).toContain('--space-4: 2rem;');
    expect(after).not.toContain('--space-4: 1rem;');
  });
});

// Helpers kept near the tests that use them (computed at call time).
function classForBox(): string {
  // mirror of classFor in src/compile/classFor.ts
  let h = 2166136261;
  for (let i = 0; i < BOX.length; i++) {
    h ^= BOX.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `r-${(h >>> 0).toString(16).padStart(6, '0')}`;
}
function classFor(nodeId: string): string {
  let h = 2166136261;
  for (let i = 0; i < nodeId.length; i++) {
    h ^= nodeId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `r-${(h >>> 0).toString(16).padStart(6, '0')}`;
}

describe('compileStyles: preview widths never leak into media queries', () => {
  it('uses only 1023px and 767px breakpoints, never 1440/768/390', () => {
    const out = compileStyles(mkProject(TREE), 'pg-1' as PageId, TREE);
    const queries = out.match(/@media[^{]*/g) ?? [];
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) {
      expect(q).toMatch(/max-width:\s*(1023|767)px/);
      expect(q).not.toMatch(/1440|768|390/);
    }
  });
});

describe('compileStyles — section blend', () => {
  const BROOT = 'page-2';
  const BSA = 'sec-a';
  const BSB = 'sec-b';
  const BSC = 'sec-c';
  const BBOX = 'box-2';

  const colorLayer = (id: string, color: string): BackgroundLayer => ({
    id,
    type: 'color',
    enabled: true,
    opacity: 1,
    blendMode: 'normal',
    color,
  });

  const blendTree: Record<string, Node> = {
    [BROOT]: {
      id: BROOT,
      type: 'page',
      parentId: null,
      children: [BSA, BSB, BSC, BBOX],
      styles: {},
      hidden: {},
      locked: false,
      title: 'Home',
      slug: 'home',
      backgroundLayers: [],
    },
    [BSA]: {
      id: BSA,
      type: 'section',
      parentId: BROOT,
      children: [],
      styles: {},
      hidden: {},
      locked: false,
      backgroundLayers: [colorLayer('bg-a', '#ff0000')],
      sectionBlend: { enabled: true, feather: 120, overlap: 0 },
    },
    [BSB]: {
      id: BSB,
      type: 'section',
      parentId: BROOT,
      children: [],
      styles: {},
      hidden: {},
      locked: false,
      backgroundLayers: [colorLayer('bg-b', '#0000ff')],
      sectionBlend: { enabled: true, feather: 120, overlap: 0 },
    },
    [BSC]: {
      id: BSC,
      type: 'section',
      parentId: BROOT,
      children: [],
      styles: {},
      hidden: {},
      locked: false,
      backgroundLayers: [colorLayer('bg-c', '#00ff00')],
      sectionBlend: { enabled: true, feather: 120, overlap: 0 },
    },
    [BBOX]: {
      id: BBOX,
      type: 'box',
      parentId: BROOT,
      children: [],
      styles: {},
      hidden: {},
      locked: false,
    },
  };

  function blendProject(_tree: Record<string, Node>): Project {
    return project([page('pg-2', BROOT)], {});
  }

  function sectionRule(out: string, nodeId: string): string {
    const cls = classFor(nodeId);
    const m = out.match(new RegExp(`\\.${cls}\\s*\\{[^}]*\\}`));
    if (!m) throw new Error(`no rule for ${cls} in ${out}`);
    return m[0]!;
  }

  function wrapRule(out: string, nodeId: string): string {
    const cls = classFor(nodeId);
    const m = out.match(new RegExp(`\\.${cls} > \\.r-bg\\{[^}]*\\}`));
    if (!m) throw new Error(`no .r-bg wrapper rule for ${cls} in ${out}`);
    return m[0]!;
  }

  function hasWrapRule(out: string, nodeId: string): boolean {
    const cls = classFor(nodeId);
    return new RegExp(`\\.${cls} > \\.r-bg\\{`).test(out);
  }

  it('gives blended sections increasing wrapper z-index (-1000, -999, -998) in document order', () => {
    const out = compileStyles(blendProject(blendTree), 'pg-2', blendTree);
    expect(wrapRule(out, BSA)).toContain('z-index:-1000');
    expect(wrapRule(out, BSB)).toContain('z-index:-999');
    expect(wrapRule(out, BSC)).toContain('z-index:-998');
  });

  it('puts feather mask-image on .r-<hash> > .r-bg, never on the section rule', () => {
    const out = compileStyles(blendProject(blendTree), 'pg-2', blendTree);
    const mask =
      'mask-image:linear-gradient(to bottom, transparent 0, #000 120px, #000 calc(100% - 120px), transparent 100%)';
    expect(sectionRule(out, BSA)).not.toContain('mask-image');
    expect(sectionRule(out, BSA)).not.toContain('-webkit-mask-image');
    expect(wrapRule(out, BSA)).toContain(mask);
    expect(wrapRule(out, BSA)).toContain(`-webkit-mask-image:${mask.slice('mask-image:'.length)}`);
  });

  it('overlap 120 renders top:-120px on the wrapper', () => {
    const tree = {
      ...blendTree,
      [BSA]: { ...blendTree[BSA], sectionBlend: { enabled: true, feather: 0, overlap: 120 } } as Node,
    };
    const out = compileStyles(blendProject(tree), 'pg-2', tree);
    expect(wrapRule(out, BSA)).toContain('z-index:-1000');
    expect(wrapRule(out, BSA)).toContain('top:-120px');
    expect(wrapRule(out, BSA)).not.toContain('mask-image');
  });

  it('emits no blend CSS when blend is disabled', () => {
    const tree = {
      ...blendTree,
      [BSA]: { ...blendTree[BSA], sectionBlend: { enabled: false, feather: 120, overlap: 0 } } as Node,
    };
    const out = compileStyles(blendProject(tree), 'pg-2', tree);
    expect(hasWrapRule(out, BSA)).toBe(false);
    expect(sectionRule(out, BSA)).not.toContain('mask-image');
    expect(sectionRule(out, BSA)).not.toContain('top:-');
  });

  it('gives the page isolation:isolate when any section blends', () => {
    const out = compileStyles(blendProject(blendTree), 'pg-2', blendTree);
    const root = sectionRule(out, BROOT);
    expect(root).toContain('position: relative');
    expect(root).toContain('isolation: isolate');
  });

  it('featherTop overrides feather for the top edge only', () => {
    const tree = {
      ...blendTree,
      [BSA]: {
        ...blendTree[BSA],
        sectionBlend: { enabled: true, feather: 120, featherTop: 60, overlap: 0 },
      } as Node,
    };
    const out = compileStyles(blendProject(tree), 'pg-2', tree);
    expect(wrapRule(out, BSA)).toContain(
      'mask-image:linear-gradient(to bottom, transparent 0, #000 60px, #000 calc(100% - 120px), transparent 100%)',
    );
  });

  it('rounds blend px values to whole numbers', () => {
    const tree = {
      ...blendTree,
      [BSA]: { ...blendTree[BSA], sectionBlend: { enabled: true, feather: 12.6, overlap: 0 } } as Node,
    };
    const out = compileStyles(blendProject(tree), 'pg-2', tree);
    expect(wrapRule(out, BSA)).toContain('#000 13px');
    expect(wrapRule(out, BSA)).not.toContain('12.6');
  });
});
