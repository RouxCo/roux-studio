// src/compile/compileStyles.ts
// Roux Studio — compile a page into CSS.
//
// Pure: no React, no store, no DOM. The output is a CSS string containing:
//   1. :root CSS variables for every token in project.tokens.byName
//   2. element base styles, emitted once at the top
//   3. one `.r-<hash>` rule per node, walked in document order, desktop-first:
//      the base rule holds desktop values; `@media (max-width: 1023px)` and
//      `@media (max-width: 767px)` blocks hold only the keys whose resolved
//      value differs at that breakpoint (hidden → `display:none` in the
//      matching breakpoint only).
//
// No inline `style` attributes are emitted — export consumes classes only.
// `c-{hash}` dedupe is deferred to M5.
import type {
  Breakpoint,
  DesignTokens,
  Length,
  Node,
  NodeId,
  PageId,
  Project,
  ResponsiveStyles,
} from '../types';
import { isPageNode, isSectionNode } from '../types';
import { classFor } from './classFor';
import { resolveStyle } from './resolveStyle';
import { resolveResponsive } from '../types';
import {
  compileLayerRules,
  fastBackground,
  needsLayeredPath,
  visibleLayers,
} from './backgrounds';

const TABLET = '(max-width: 1023px)';
const MOBILE = '(max-width: 767px)';

type Bucket = Map<string, string>;

export function compileStyles(
  project: Project,
  pageId: PageId,
  nodes: Record<NodeId, Node>,
): string {
  const page = project.pages.find((p) => p.id === pageId);
  if (!page) return '';
  const root = nodes[page.rootId];
  if (!root) return '';

  const parts: string[] = [];
  const tokens = compileTokens(project.tokens);
  if (tokens) parts.push(tokens);
  parts.push(compileBaseStyles());

  const seen = new Set<NodeId>();
  const walk = (id: NodeId) => {
    const node = nodes[id];
    if (!node || seen.has(id)) return;
    seen.add(id);
    const css = compileNode(node);
    if (css) parts.push(css);
    for (const child of node.children) walk(child);
  };
  walk(page.rootId);

  return parts.join('\n');
}

function compileTokens(tokens: DesignTokens): string {
  const names = Object.keys(tokens.byName).sort();
  if (names.length === 0) return '';
  const vars = names.map((name) => {
    const token = tokens.byName[name]!;
    return `  --${name}: ${token.value};`;
  });
  return `:root {\n${vars.join('\n')}\n}`;
}

function compileBaseStyles(): string {
  return [
    'html { box-sizing: border-box; }',
    '*, *::before, *::after { box-sizing: inherit; }',
    'body { margin: 0; }',
    'section, article, nav, footer, header, main, div, form { display: block; }',
    'h1, h2, h3, h4, h5, h6, p { margin: 0; }',
    'button { margin: 0; font: inherit; }',
    'a { color: inherit; text-decoration: none; }',
    'img { display: block; max-width: 100%; }',
    // Shared background-layer wrapper, emitted once for every page. Page/section
    // nodes with layered backgrounds establish position:relative + isolate so
    // their .r-bg layers stack inside them (z-index: -1 on .r-bg).
    '.r-bg{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none}',
    '.r-bg-video{width:100%;height:100%;object-fit:cover}',
  ].join('\n');
}

function compileNode(node: Node): string {
  const cls = classFor(node.id);
  const base: Bucket = new Map();
  const tablet: Bucket = new Map();
  const mobile: Bucket = new Map();

  const keys = Object.keys(node.styles) as (keyof ResponsiveStyles)[];
  for (const key of keys) {
    const desktop = resolveStyle(node, 'desktop', key);
    const cd = serialize(desktop);
    if (cd === undefined || cd === '') continue;
    base.set(kebab(key), cd);

    const tabletv = resolveStyle(node, 'tablet', key);
    const ct = serialize(tabletv);
    if (tabletv !== undefined && ct !== undefined && ct !== cd) {
      tablet.set(kebab(key), ct);
    }

    const mobilev = resolveStyle(node, 'mobile', key);
    const inherited = tabletv !== undefined ? tabletv : desktop;
    const ci = serialize(inherited);
    const cm = serialize(mobilev);
    if (mobilev !== undefined && cm !== undefined && cm !== ci) {
      mobile.set(kebab(key), cm);
    }
  }

  // hidden is a per-breakpoint override (desktop-first: mobile ?? tablet ??
  // desktop), rendered as display:none only where it takes effect.
  const hD = hiddenAt(node, 'desktop');
  const hT = hiddenAt(node, 'tablet');
  const hM = hiddenAt(node, 'mobile');
  if (hD) base.set('display', 'none');
  if (hT !== hD) {
    const v = hT ? 'none' : 'block';
    if (v === 'none' || !tablet.has('display')) tablet.set('display', v);
  }
  if (hM !== hT) {
    const v = hM ? 'none' : 'block';
    if (v === 'none' || !mobile.has('display')) mobile.set('display', v);
  }

  const out: string[] = [];

  // Background layers (page and section nodes only). Fast path: one `background:`
  // list on the element. Layered path: relative + isolated containment plus
  // per-layer rules appended below; the shared .r-bg rule comes from
  // compileBaseStyles and is emitted once for the whole page.
  if (isPageNode(node) || isSectionNode(node)) {
    const layers = visibleLayers(node.backgroundLayers);
    if (layers.length) {
      if (needsLayeredPath(layers)) {
        base.set('position', 'relative');
        base.set('isolation', 'isolate');
        const layerCss = compileLayerRules(layers);
        if (layerCss) out.push(layerCss);
      } else {
        base.set('background', fastBackground(layers));
      }
    }
  }

  if (base.size) out.push(rule(cls, base));
  if (tablet.size) out.push(query(TABLET, cls, tablet));
  if (mobile.size) out.push(query(MOBILE, cls, mobile));
  return out.join('\n');
}

function hiddenAt(node: Node, bp: Breakpoint): boolean {
  return resolveResponsive(bp, node.hidden) === true;
}

function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

type StyleValue = string | number | Length;

function serialize(value: StyleValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value === 'normal' ? undefined : value;
  if (typeof value === 'number') return cssNumber(value);
  return lengthToCss(value);
}

function cssNumber(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

function lengthToCss(value: Length): string {
  switch (value.kind) {
    case 'px':
      return cssNumber(value.value) + 'px';
    case 'rem':
      return cssNumber(value.value) + 'rem';
    case 'em':
      return cssNumber(value.value) + 'em';
    case 'pct':
      return cssNumber(value.value) + '%';
    case 'vh':
      return cssNumber(value.value) + 'vh';
    case 'vw':
      return cssNumber(value.value) + 'vw';
    case 'token':
      return value.token ? `var(--${value.token})` : '';
    case 'auto':
      return 'auto';
  }
}

function rule(cls: string, props: Bucket): string {
  const decls = [...props.entries()]
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `.${cls} {\n${decls}\n}`;
}

function query(cond: string, cls: string, props: Bucket): string {
  const decls = [...props.entries()]
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `@media ${cond} {\n.${cls} {\n${decls}\n}\n}`;
}
