// src/canvas/renderNode.tsx
// Roux Studio — pure element renderer.
//
// One renderer serves both the iframe canvas (mode: 'canvas') and the static
// exporter (mode: 'export') — spec §4.4. Canvas output carries data-node-id
// attributes for hit-testing and selection; export output omits editor
// artefacts. Styles resolve per active breakpoint from ResponsiveStyles
// (desktop-first, mobile ?? tablet ?? desktop) and are captured in every
// node's r-{hash} class name (M4's compileStyles compiles each class into a
// CSS rule); no inline style attributes are emitted in either mode.
//
// This module is the element registry: every ElementType from spec §4 maps to
// markup here.
import { Fragment, useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, ComponentType, ElementType, JSX, SVGAttributes } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Home,
  Mail,
  Menu,
  Phone,
  Plus,
  Search,
  Settings,
  User,
} from 'lucide-react';
import type {
  Breakpoint,
  IconNode,
  Length,
  Node,
  NodeId,
  Responsive,
  ResponsiveStyles,
} from '../types';
import { resolveResponsive } from '../types';
import { classFor } from '../compile/classFor';
import { visibleLayers, usesLayeredPath, layerClass } from '../compile/backgrounds';

export interface RenderContext {
  mode: 'canvas' | 'export';
  breakpoint: Breakpoint;
  nodes: Record<NodeId, Node>;
  // Id → blob URL map for uploaded assets. When a node's src (image, imageItem,
  // or background image layer) matches a key here it is replaced with the blob
  // URL so the image paints on the canvas. External URLs (://) pass through.
  assetUrls?: Record<string, string>;
  // Inline text editing (canvas mode only). When editingNodeId matches a node's
  // id that node renders contentEditable. On blur the new text is saved through
  // onSaveText as exactly one undo step; onCancelEditing aborts without saving.
  editingNodeId?: NodeId | null;
  onStartEditing?: (id: NodeId) => void;
  onSaveText?: (id: NodeId, text: string) => void;
  onCancelEditing?: () => void;
  // Canvas-only: when true, video background layers render a <video> so they
  // play on the canvas. Not persisted, not undoable.
  playBackgrounds?: boolean;
  // Global header/footer rendered by this page. Null when the page has opted
  // out (Canvas passes them only when Page.useGlobalHeader/useGlobalFooter is
  // true) or the global subtree does not exist. The subtree nodes live in
  // `nodes` with parentId null and belong to no page's children array.
  globalHeaderId?: NodeId | null;
  globalFooterId?: NodeId | null;
}

const DATA_NODE_ID = 'data-node-id';

function canvasAttrs(node: Node, ctx: RenderContext): Record<string, string> {
  return ctx.mode === 'canvas' ? { [DATA_NODE_ID]: node.id } : {};
}

// Resolve a node's src attribute: if assetUrls has an entry for it use the blob
// URL; otherwise pass the value through unchanged (external URLs, or ids whose
// asset hasn't been loaded yet).
function resolveSrc(src: string | undefined, ctx: RenderContext): string | undefined {
  if (!src) return src;
  if (ctx.assetUrls && ctx.assetUrls[src]) return ctx.assetUrls[src];
  return src;
}

export function lengthToCss(value: Length | 'auto' | 'none'): string {
  if (typeof value === 'string') return value;
  switch (value.kind) {
    case 'px':
      return `${value.value}px`;
    case 'rem':
      return `${value.value}rem`;
    case 'em':
      return `${value.value}em`;
    case 'pct':
      return `${value.value}%`;
    case 'vh':
      return `${value.value}vh`;
    case 'vw':
      return `${value.value}vw`;
    case 'token':
      return value.token ? `var(--${value.token})` : '';
    case 'auto':
      return 'auto';
  }
}

export function resolveStyles(styles: ResponsiveStyles, bp: Breakpoint): CSSProperties {
  const out: Record<string, string | number> = {};
  const add = (key: string, value: string | number | undefined) => {
    if (value !== undefined) {
      out[key] = value;
    }
  };
  function resolve<T>(v: Responsive<T> | undefined): T | undefined {
    return resolveResponsive(bp, v);
  }

  const asLength = (v: Responsive<Length | 'auto' | 'none'> | undefined): string | undefined => {
    const r = resolve(v);
    return r === undefined ? undefined : lengthToCss(r);
  };

  const asLengthOrNormal = (v: Responsive<Length | 'normal'> | undefined): string | undefined => {
    const r = resolve(v);
    if (r === undefined || r === 'normal') return undefined;
    return lengthToCss(r);
  };

  const asLineHeight = (
    v: Responsive<Length | 'normal' | number> | undefined,
  ): string | number | undefined => {
    const r = resolve(v);
    if (r === undefined) return undefined;
    if (typeof r === 'number') return r;
    return r === 'normal' ? undefined : lengthToCss(r);
  };

  add('display', resolve(styles.display));
  add('flexDirection', resolve(styles.flexDirection));
  add('flexWrap', resolve(styles.flexWrap));
  add('justifyContent', resolve(styles.justifyContent));
  add('alignItems', resolve(styles.alignItems));
  add('alignContent', resolve(styles.alignContent));
  add('flex', resolve(styles.flex));
  add('flexGrow', resolve(styles.flexGrow));
  add('flexShrink', resolve(styles.flexShrink));
  add('flexBasis', asLength(styles.flexBasis));
  add('width', asLength(styles.width));
  add('height', asLength(styles.height));
  add('minWidth', asLength(styles.minWidth));
  add('minHeight', asLength(styles.minHeight));
  add('maxWidth', asLength(styles.maxWidth));
  add('maxHeight', asLength(styles.maxHeight));
  add('position', resolve(styles.position));
  add('top', asLength(styles.top));
  add('right', asLength(styles.right));
  add('bottom', asLength(styles.bottom));
  add('left', asLength(styles.left));
  add('zIndex', resolve(styles.zIndex));
  add('overflow', resolve(styles.overflow));
  add('margin', asLength(styles.margin));
  add('marginTop', asLength(styles.marginTop));
  add('marginRight', asLength(styles.marginRight));
  add('marginBottom', asLength(styles.marginBottom));
  add('marginLeft', asLength(styles.marginLeft));
  add('padding', asLength(styles.padding));
  add('paddingTop', asLength(styles.paddingTop));
  add('paddingRight', asLength(styles.paddingRight));
  add('paddingBottom', asLength(styles.paddingBottom));
  add('paddingLeft', asLength(styles.paddingLeft));
  add('fontFamily', resolve(styles.fontFamily));
  add('fontSize', asLength(styles.fontSize));
  add('fontWeight', resolve(styles.fontWeight));
  add('fontStyle', resolve(styles.fontStyle));
  add('lineHeight', asLineHeight(styles.lineHeight));
  add('letterSpacing', asLengthOrNormal(styles.letterSpacing));
  add('textAlign', resolve(styles.textAlign));
  add('textDecoration', resolve(styles.textDecoration));
  add('textTransform', resolve(styles.textTransform));
  add('color', resolve(styles.color));
  add('backgroundColor', resolve(styles.backgroundColor));
  add('opacity', resolve(styles.opacity));
  add('boxShadow', resolve(styles.boxShadow));
  const borderRadius = resolve(styles.borderRadius);
  add('borderRadius', borderRadius === undefined ? undefined : typeof borderRadius === 'string' ? borderRadius : lengthToCss(borderRadius));
  add('border', resolve(styles.border));
  add('filter', resolve(styles.filter));

  return out as CSSProperties;
}

// Explicit icon map: only the Lucide icons actually rendered by the studio,
// keyed by icon name (and a lowercase alias) so IconNode.name resolves regardless
// of casing. Anything not listed here renders the MissingIcon fallback below,
// which keeps the bundle from pulling in the whole lucide-react library.
const LUCIDE_BY_NAME: Record<string, ComponentType<SVGAttributes<SVGSVGElement>>> = {
  Menu,
  Search,
  Home,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Plus,
  Mail,
  Phone,
  ExternalLink,
};


function MissingIcon(props: SVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg {...props} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" rx="2" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function renderIcon(
  node: IconNode,
  className: string | undefined,
  attrs: Record<string, string>,
): JSX.Element {
  const Comp = LUCIDE_BY_NAME[node.name] ?? LUCIDE_BY_NAME[node.name.toLowerCase()] ?? MissingIcon;
  return <Comp {...attrs} className={className} />;
}

// Inline text editing for heading, paragraph, button and link nodes.
//
// Double-click enters contentEditable mode; blur saves the new text as exactly
// one undo step (via onSaveText). Escape cancels without saving. Only active in
// canvas mode — export mode always renders the static tag.
interface InlineTextEditProps {
  tag: ElementType;
  text: string;
  onSave: (next: string) => void;
  onCancel: () => void;
  style: CSSProperties | undefined;
  className: string | undefined;
  attrs: Record<string, string>;
  href?: string;
}

function InlineTextEdit({
  tag: Tag,
  text,
  onSave,
  onCancel,
  style,
  className,
  attrs,
  href,
}: InlineTextEditProps): JSX.Element {
  const ref = useRef<HTMLElement>(null);
  const committed = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || committed.current) return;
    el.contentEditable = 'true';
    el.dataset.editing = 'true';
    el.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback(
    (next: string) => {
      if (committed.current) return;
      committed.current = true;
      const el = ref.current;
      if (el) {
        el.contentEditable = 'false';
        delete el.dataset.editing;
      }
      onSave(next);
    },
    [onSave],
  );

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    commit(e.currentTarget.innerText ?? e.currentTarget.textContent ?? '');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Tag
      ref={ref}
      {...attrs}
      style={style}
      className={className}
      {...(href !== undefined ? { href } : {})}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      {text}
    </Tag>
  );
}

// Renders an editable text node (heading, paragraph, button, link). In canvas
// mode a double-click enters inline edit mode; otherwise the static tag is
// emitted exactly as before.
function textNode(
  node: { id: NodeId; text: string },
  Tag: ElementType,
  ctx: RenderContext,
  props: {
    style: CSSProperties | undefined;
    className: string | undefined;
    attrs: Record<string, string>;
    href?: string;
  },
): JSX.Element {
  const isEditing =
    ctx.mode === 'canvas' &&
    ctx.editingNodeId === node.id &&
    typeof ctx.onStartEditing === 'function' &&
    typeof ctx.onSaveText === 'function';

  if (isEditing) {
    return (
      <InlineTextEdit
        tag={Tag}
        text={node.text}
        onSave={(next: string) => ctx.onSaveText!(node.id, next)}
        onCancel={ctx.onCancelEditing ?? (() => {})}
        style={props.style}
        className={props.className}
        attrs={props.attrs}
        href={props.href}
      />
    );
  }

  return (
    <Tag
      {...props.attrs}
      style={props.style}
      className={props.className}
      {...(props.href !== undefined ? { href: props.href } : {})}
      onDoubleClick={
        ctx.mode === 'canvas' && typeof ctx.onStartEditing === 'function'
          ? () => ctx.onStartEditing!(node.id)
          : undefined
      }
    >
      {node.text}
    </Tag>
  );
}

export function renderNode(node: Node, ctx: RenderContext): JSX.Element {
  const style = resolveStyles(node.styles, ctx.breakpoint);
  const attrs = canvasAttrs(node, ctx);
  const children = node.children.map((id) => {
    const child = ctx.nodes[id];
    return child ? (
      <Fragment key={id}>{renderNode(child, ctx)}</Fragment>
    ) : null;
  });

  // hidden is a per-node, per-breakpoint override (desktop-first). When hidden
  // resolves to true at the active breakpoint the element renders display:none.
  if (resolveResponsive(ctx.breakpoint, node.hidden) === true) {
    style.display = 'none';
  }

  // Every node gets an r-{hash} class name (from its ID, compiled into a CSS
  // rule by M4's compileStyles) in both canvas and export mode. No inline
  // style attributes are emitted in either mode.
  const styleProp: CSSProperties | undefined = undefined;
  const className = classFor(node.id);

  switch (node.type) {
    case 'page': {
      // The global header renders after the page background and before the
      // page's own children, the global footer after them; each subtree is
      // rendered through renderNode with its own key. The header/footer
      // subtrees live in `nodes` with parentId null and belong to no page's
      // children array, so rendering them here does not recurse. Editing a
      // global node anywhere edits it on every page that opts in.
      const header = ctx.globalHeaderId ? ctx.nodes[ctx.globalHeaderId] : null;
      const footer = ctx.globalFooterId ? ctx.nodes[ctx.globalFooterId] : null;
      const layers = visibleLayers(node.backgroundLayers);
      const background =
        usesLayeredPath(node) ? (
          <div className="r-bg" aria-hidden="true">
            {[...layers].reverse().map((layer) => (
              <div key={layer.id} className={`r-bg-layer ${layerClass(layer)}`}>
                {ctx.mode === 'canvas' &&
                  ctx.playBackgrounds &&
                  layer.type === 'video' ? (
                  <video
                    src={layer.src}
                    poster={layer.poster}
                    muted
                    loop
                    playsInline
                    autoPlay
                    className="r-bg-video"
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null;
      return (
        <div {...attrs} style={styleProp} className={className}>
          {background}
          {header && (
            <Fragment key="global-header">{renderNode(header, ctx)}</Fragment>
          )}
          {children}
          {footer && (
            <Fragment key="global-footer">{renderNode(footer, ctx)}</Fragment>
          )}
        </div>
      );
    }
    case 'section': {
      const Tag = 'section';
      const layers = visibleLayers(node.backgroundLayers);
      // Layered backgrounds render an aria-hidden .r-bg wrapper as the first
      // child, holding one .r-bg-layer per visible layer in reverse order
      // (bottom layer first in the DOM). No inline styles are emitted.
      const background =
        usesLayeredPath(node) ? (
          <div className="r-bg" aria-hidden="true">
            {[...layers].reverse().map((layer) => (
              <div key={layer.id} className={`r-bg-layer ${layerClass(layer)}`}>
                {ctx.mode === 'canvas' &&
                  ctx.playBackgrounds &&
                  layer.type === 'video' ? (
                  <video
                    src={layer.src}
                    poster={layer.poster}
                    muted
                    loop
                    playsInline
                    autoPlay
                    className="r-bg-video"
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null;
      return (
        <Tag {...attrs} style={styleProp} className={className}>
          {background}
          {children}
        </Tag>
      );
    }
    case 'container':
    case 'box':
      return <div {...attrs} style={styleProp} className={className}>{children}</div>;
    case 'heading': {
      const Tag = ('h' + node.level) as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return textNode(node, Tag, ctx, { style: styleProp, className, attrs });
    }
    case 'paragraph':
      return textNode(node, 'p', ctx, { style: styleProp, className, attrs });
    case 'richText':
      return <div {...attrs} style={styleProp} className={className}>{children}</div>;
    case 'button':
      return textNode(node, 'button', ctx, { style: styleProp, className, attrs });
    case 'link':
      return textNode(node, 'a', ctx, { style: styleProp, className, attrs, href: node.href });
    case 'image':
      return <img src={resolveSrc(node.src, ctx)} alt={node.alt} {...attrs} style={styleProp} className={className} />;
    case 'icon':
      return renderIcon(node, className, attrs);
    case 'form':
      return <form {...attrs} style={styleProp} className={className}>{children}</form>;
    case 'formField':
    case 'faq':
    case 'faqItem':
    case 'slider':
    case 'slide':
    case 'gallery':
    case 'imageItem':
    case 'pricingTable':
    case 'card':
      return <div {...attrs} style={styleProp} className={className}>{children}</div>;
    case 'nav':
      return <nav {...attrs} style={styleProp} className={className}>{children}</nav>;
    case 'footer':
      return <footer {...attrs} style={styleProp} className={className}>{children}</footer>;
    case 'componentInstance':
      return <div {...attrs} style={styleProp} className={className} data-component-id={node.componentId}>{children}</div>;
  }
}
