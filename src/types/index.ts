// Roux Studio — core data-model types (spec §4).
//
// Flat nodes map keyed by ID + children ID arrays + parentId.
// ResponsiveStyles desktop-first: mobile ?? tablet ?? desktop.
// BackgroundLayer stack, SectionBlend, DesignTokens with var(--...) references.

export type NodeId = string;
export type PageId = string;

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export type ElementType =
  | 'page'
  | 'section'
  | 'container'
  | 'box'
  | 'heading'
  | 'paragraph'
  | 'richText'
  | 'button'
  | 'link'
  | 'image'
  | 'icon'
  | 'form'
  | 'formField'
  | 'faq'
  | 'faqItem'
  | 'slider'
  | 'slide'
  | 'gallery'
  | 'imageItem'
  | 'pricingTable'
  | 'card'
  | 'nav'
  | 'footer'
  | 'componentInstance';

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export type BackgroundLayerType =
  | 'color'
  | 'gradient'
  | 'image'
  | 'video'
  | 'noise'
  | 'tint'
  | 'slideshow';

export interface Length {
  kind: 'px' | 'rem' | 'em' | 'pct' | 'vh' | 'vw' | 'token' | 'auto';
  value: number;
  token?: string; // set when kind === 'token', e.g. { kind: 'token', token: 'space-4' }
}

export type Responsive<T> = {
  desktop?: T;
  tablet?: T;
  mobile?: T;
};

// desktop-first resolution: mobile ?? tablet ?? desktop
export function resolveResponsive<T>(bp: Breakpoint, value?: Responsive<T>): T | undefined {
  if (!value) return undefined;
  if (bp === 'mobile' && value.mobile !== undefined) return value.mobile;
  if (bp === 'tablet' && value.tablet !== undefined) return value.tablet;
  return value.desktop;
}

export interface BackgroundLayerBase {
  id: string;
  type: BackgroundLayerType;
  name?: string;
  enabled: boolean;
  opacity: number; // 0..1
  blendMode: BlendMode;
}

export interface ColorLayer extends BackgroundLayerBase {
  type: 'color';
  color: string; // hex
}

export interface GradientLayer extends BackgroundLayerBase {
  type: 'gradient';
  angle: number; // degrees
  stops: { offset: number; color: string }[];
}

export interface ImageLayer extends BackgroundLayerBase {
  type: 'image';
  src: string; // asset id or url
  size: 'cover' | 'contain' | 'auto';
  position: string;
  repeat: 'repeat' | 'no-repeat' | 'repeat-x' | 'repeat-y';
  blur?: number; // px, 0 = none
  brightness?: number; // 1 = normal
}

export interface VideoLayer extends BackgroundLayerBase {
  type: 'video';
  src: string;
  loop: boolean;
  muted: boolean;
  poster: string;
}

export interface NoiseLayer extends BackgroundLayerBase {
  type: 'noise';
  intensity?: number; // 0..1, default 0.15
  scale?: number; // default 0.8
}

export interface TintLayer extends BackgroundLayerBase {
  type: 'tint';
  color: string;
}

export interface SlideshowLayer extends BackgroundLayerBase {
  type: 'slideshow';
  srcs: string[];
  interval: number; // ms
  transition?: number; // ms
}

export type BackgroundLayer =
  | ColorLayer
  | GradientLayer
  | ImageLayer
  | VideoLayer
  | NoiseLayer
  | TintLayer
  | SlideshowLayer;

export interface SectionBlend {
  enabled: boolean;
  feather: number; // px
  overlap: number; // px (negative overlap via top: -Npx on .r-bg wrapper)
  featherTop?: number; // px; falls back to feather
  featherBottom?: number; // px; falls back to feather
}

export interface DesignToken {
  name: string; // e.g. 'color-primary'
  value: string; // e.g. '#0f766e' or a var(--...) reference
  type: 'color' | 'spacing' | 'length' | 'number';
}

export interface DesignTokens {
  byName: Record<string, DesignToken>;
}

export type Display = 'block' | 'flex' | 'inline-flex' | 'grid' | 'inline-grid' | 'none' | 'contents';

export interface ResponsiveStyles {
  // Layout
  display?: Responsive<Display>;
  flexDirection?: Responsive<'row' | 'row-reverse' | 'column' | 'column-reverse'>;
  flexWrap?: Responsive<'nowrap' | 'wrap' | 'wrap-reverse'>;
  justifyContent?: Responsive<'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'>;
  alignItems?: Responsive<'stretch' | 'flex-start' | 'flex-end' | 'center' | 'baseline'>;
  alignContent?: Responsive<'stretch' | 'start' | 'end' | 'center' | 'space-between' | 'space-around'>;
  gap?: Responsive<Length>;
  flex?: Responsive<string>;
  flexGrow?: Responsive<number>;
  flexShrink?: Responsive<number>;
  flexBasis?: Responsive<Length | 'auto'>;
  width?: Responsive<Length | 'auto'>;
  height?: Responsive<Length | 'auto'>;
  minWidth?: Responsive<Length | 'auto'>;
  minHeight?: Responsive<Length | 'auto'>;
  maxWidth?: Responsive<Length | 'none' | 'auto'>;
  maxHeight?: Responsive<Length | 'none' | 'auto'>;
  position?: Responsive<'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'>;
  top?: Responsive<Length | 'auto'>;
  right?: Responsive<Length | 'auto'>;
  bottom?: Responsive<Length | 'auto'>;
  left?: Responsive<Length | 'auto'>;
  zIndex?: Responsive<number | 'auto'>;
  overflow?: Responsive<'visible' | 'hidden' | 'clip' | 'scroll' | 'auto'>;
  margin?: Responsive<Length>;
  marginTop?: Responsive<Length>;
  marginRight?: Responsive<Length>;
  marginBottom?: Responsive<Length>;
  marginLeft?: Responsive<Length>;
  padding?: Responsive<Length>;
  paddingTop?: Responsive<Length>;
  paddingRight?: Responsive<Length>;
  paddingBottom?: Responsive<Length>;
  paddingLeft?: Responsive<Length>;

  // Typography
  fontFamily?: Responsive<string>;
  fontSize?: Responsive<Length>;
  fontWeight?: Responsive<number | string>;
  fontStyle?: Responsive<'normal' | 'italic' | 'oblique'>;
  lineHeight?: Responsive<Length | 'normal' | number>;
  letterSpacing?: Responsive<Length | 'normal'>;
  textAlign?: Responsive<'left' | 'center' | 'right' | 'justify' | 'start' | 'end'>;
  textDecoration?: Responsive<'none' | 'underline' | 'overline' | 'line-through'>;
  textTransform?: Responsive<'none' | 'capitalize' | 'uppercase' | 'lowercase'>;
  color?: Responsive<string>;

  // Colors / Background / Effects
  backgroundColor?: Responsive<string>;
  opacity?: Responsive<number>;
  boxShadow?: Responsive<string>;
  borderRadius?: Responsive<Length | string>;
  border?: Responsive<string>;
  filter?: Responsive<string>;
}

export interface BaseNode {
  id: NodeId;
  type: ElementType;
  parentId: NodeId | null;
  children: NodeId[];
  styles: ResponsiveStyles;
  hidden: Responsive<boolean>;
  locked: boolean;
}

export interface PageNode extends BaseNode {
  type: 'page';
  title: string;
  slug: string;
  backgroundLayers: BackgroundLayer[];
}

export interface SectionNode extends BaseNode {
  type: 'section';
  backgroundLayers: BackgroundLayer[];
  sectionBlend: SectionBlend;
}

export interface ContainerNode extends BaseNode {
  type: 'container';
}

export interface BoxNode extends BaseNode {
  type: 'box';
}

export interface HeadingNode extends BaseNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface ParagraphNode extends BaseNode {
  type: 'paragraph';
  text: string;
}

export interface RichTextNode extends BaseNode {
  type: 'richText';
  content: unknown; // Tiptap JSON
}

export interface ButtonNode extends BaseNode {
  type: 'button';
  text: string;
  href?: string;
}

export interface LinkNode extends BaseNode {
  type: 'link';
  href: string;
  text: string;
}

export interface ImageNode extends BaseNode {
  type: 'image';
  src: string; // asset id or url
  alt: string;
}

export interface IconNode extends BaseNode {
  type: 'icon';
  name: string; // lucide icon name
}

export interface FormNode extends BaseNode {
  type: 'form';
  action?: string;
  method: 'get' | 'post';
}

export interface FormFieldNode extends BaseNode {
  type: 'formField';
  label: string;
  name: string;
  inputType: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' | 'radio';
}

export interface FaqNode extends BaseNode {
  type: 'faq';
}

export interface FaqItemNode extends BaseNode {
  type: 'faqItem';
  question: string;
  answer: string;
}

export interface SliderNode extends BaseNode {
  type: 'slider';
}

export interface SlideNode extends BaseNode {
  type: 'slide';
}

export interface GalleryNode extends BaseNode {
  type: 'gallery';
}

export interface ImageItemNode extends BaseNode {
  type: 'imageItem';
  src: string;
  alt: string;
}

export interface PricingTableNode extends BaseNode {
  type: 'pricingTable';
}

export interface CardNode extends BaseNode {
  type: 'card';
}

export interface NavNode extends BaseNode {
  type: 'nav';
}

export interface FooterNode extends BaseNode {
  type: 'footer';
}

export interface ComponentInstanceNode extends BaseNode {
  type: 'componentInstance';
  componentId: string;
}

export type Node =
  | PageNode
  | SectionNode
  | ContainerNode
  | BoxNode
  | HeadingNode
  | ParagraphNode
  | RichTextNode
  | ButtonNode
  | LinkNode
  | ImageNode
  | IconNode
  | FormNode
  | FormFieldNode
  | FaqNode
  | FaqItemNode
  | SliderNode
  | SlideNode
  | GalleryNode
  | ImageItemNode
  | PricingTableNode
  | CardNode
  | NavNode
  | FooterNode
  | ComponentInstanceNode;

export function isPageNode(node: Node): node is PageNode {
  return node.type === 'page';
}

export function isSectionNode(node: Node): node is SectionNode {
  return node.type === 'section';
}

export interface Asset {
  id: string;
  name: string;
  mimeType: string;
  size: number; // bytes; stored as a Blob in the IndexedDB assets store
}

export interface Page {
  id: PageId;
  title: string;
  slug: string;
  rootId: NodeId; // page node id
}

export interface Project {
  id: string;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  pages: Page[];
  tokens: DesignTokens;
}

export interface EditorData {
  projectId: string | null;
  projectName: string;
  pages: Page[];
  tokens: DesignTokens;
  nodes: Record<NodeId, Node>;
  currentPageId: PageId | null;
  breakpoint: Breakpoint;
  selection: NodeId[];
}

export function emptyEditorData(): EditorData {
  return {
    projectId: null,
    projectName: 'Untitled',
    pages: [],
    tokens: { byName: {} },
    nodes: {},
    currentPageId: null,
    breakpoint: 'desktop',
    selection: [],
  };
}
