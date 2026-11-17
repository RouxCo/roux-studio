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
  blendActive,
  compileLayerRules,
  fastBackground,
  needsLayeredPath,
  usesLayeredPath,
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

  // True when any section on this page has an active blend: the page then
  // becomes the stacking context (isolation: isolate) that contains every
  // section background.
  const pageHasBlend = Object.values(nodes).some(
    (node) => isSectionNode(node) && blendActive(node),
  );
  let sectionIndex = 0; // counts sections in document order, from 0

  const walk = (id: NodeId) => {
    const node = nodes[id];
    if (!node || seen.has(id)) return;
    seen.add(id);
    const index = isSectionNode(node) ? sectionIndex++ : undefined;
    const css = compileNode(node, index, pageHasBlend);
    if (css) parts.push(css);
    for (const child of node.children) walk(child);
  };

  // The global header/footer subtrees live outside any page (parentId null)
  // but are rendered by every page that opts in, so their r- classes must be
  // in this page's CSS. Walk the header subtree before the page root's
  // children and the footer after; the shared sectionIndex counts them in
  // document order, just like the renderer.
  if (page.useGlobalHeader && project.globalHeaderId) walk(project.globalHeaderId);
  walk(page.rootId);
  if (page.useGlobalFooter && project.globalFooterId) walk(project.globalFooterId);

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

function compileNode(node: Node, sectionIndex?: number, pageHasBlend = false): string {
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

  // Background layers (page and section nodes only).
  //
  // Z-order scheme for section blends:
  //   - the page gets position:relative + isolation:isolate whenever any section
  //     on it has an active blend, so it becomes the stacking context that
  //     contains every section background;
  //   - a blended section gets position:relative but NOT isolation (its .r-bg
  //     joins the page's stacking context) plus overflow:visible so an
  //     overlapped background can paint outside the section;
  //   - each blended section's wrapper gets
  //     `.r-<hash> > .r-bg{z-index:-1000+sectionIndex}` (sections counted in
  //     document order from 0) so later sections' backgrounds sit above earlier
  //     ones while every background stays below in-flow content; the page's own
  //     .r-bg gets z-index -2000;
  //   - blend CSS (feather mask-image, overlap top:) goes on the bg wrapper
  //     only (`.r-<hash> > .r-bg`), never on the section itself; all blend px
  //     values round to whole numbers to avoid sub-pixel seams.
  //
  // Fast path: one `background:` list on the element. Layered path: relative
  // containment plus per-layer rules appended below; the shared .r-bg rule
  // comes from compileBaseStyles and is emitted once for the whole page.
  if (isPageNode(node) || isSectionNode(node)) {
    const layers = visibleLayers(node.backgroundLayers);
    const isBlend = isSectionNode(node) && blendActive(node);
    const layered = layers.length > 0 && usesLayeredPath(node);

    if (layered || (isPageNode(node) && pageHasBlend)) {
      base.set('position', 'relative');
    }
    if (isPageNode(node)) {
      if (needsLayeredPath(layers) || pageHasBlend) base.set('isolation', 'isolate');
    } else if (layered && !isBlend) {
      if (needsLayeredPath(layers)) base.set('isolation', 'isolate');
    }
    if (layered) {
      if (isBlend) base.set('overflow', 'visible');
      const layerCss = compileLayerRules(layers);
      if (layerCss) out.push(layerCss);
      if (isPageNode(node) && pageHasBlend) {
        out.push(`.${cls} > .r-bg{z-index:-2000}`);
      }
      if (isBlend && sectionIndex !== undefined) {
        const wrapper: string[] = [`z-index:${-1000 + sectionIndex}`];
        const b = node.sectionBlend;
        const top = Math.round(b.featherTop ?? b.feather);
        const bottom = Math.round(b.featherBottom ?? b.feather);
        const overlap = Math.round(b.overlap);
        if (top > 0 || bottom > 0) {
          const mask = `linear-gradient(to bottom, transparent 0, #000 ${top}px, #000 calc(100% - ${bottom}px), transparent 100%)`;
          wrapper.push(`mask-image:${mask}`, `-webkit-mask-image:${mask}`);
        }
        if (overlap > 0) wrapper.push(`top:-${overlap}px`);
        out.push(`.${cls} > .r-bg{${wrapper.join(';')}};`);
      }
    } else if (layers.length > 0) {
      base.set('background', fastBackground(layers));
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
