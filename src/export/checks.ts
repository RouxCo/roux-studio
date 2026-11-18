// src/export/checks.ts
// Roux Studio — pre-export errors/warnings checks (spec §11.5).
//
// `runPreExportChecks(project, nodes)` returns a PreExportResult with
// Errors (block export unless "Export anyway") and Warnings. Each item
// carries a nodeId for click-to-select (null for page-level checks).
//
// Checks computable from project + nodes alone:
//   Errors: page with no title, duplicate slugs.
//   Warnings: images without alt, zero/multiple H1s, heading-level skips,
//             links/buttons with no accessible name, body text below 16px,
//             low color contrast, missing font family, missing/short/long
//             meta description.

import { resolveResponsive } from '../types';
import type { Length, Node, NodeId, Project } from '../types';

export interface CheckItem {
  id: string;
  message: string;
  nodeId: NodeId | null;
  type: 'error' | 'warning';
}

export interface PreExportResult {
  errors: CheckItem[];
  warnings: CheckItem[];
}

const EMPTY_TITLE = 'no-title';
const DUPLICATE_SLUG = 'duplicate-slug';
const IMAGE_NO_ALT = 'image-no-alt';
const ZERO_H1 = 'zero-h1';
const MULTIPLE_H1 = 'multiple-h1';
const HEADING_SKIP = 'heading-skip';
const NO_ACCESSIBLE_NAME = 'no-accessible-name';

const TEXT_SIZE_TOO_SMALL = 'text-size-too-small';
const LOW_CONTRAST = 'low-contrast';
const MISSING_FONT = 'missing-font';
const META_DESCRIPTION_MISSING = 'meta-description-missing';
const META_DESCRIPTION_TOO_SHORT = 'meta-description-too-short';
const META_DESCRIPTION_TOO_LONG = 'meta-description-too-long';

const MIN_BODY_FONT_SIZE_PX = 16;
const MIN_CONTRAST_RATIO = 4.5;
const META_DESCRIPTION_MIN_CHARS = 50;
const META_DESCRIPTION_MAX_CHARS = 160;

const TEXT_NODE_TYPES = new Set(['heading', 'paragraph', 'richText', 'button', 'link']);
const BODY_TEXT_NODE_TYPES = new Set(['paragraph', 'richText']);

function isHeading(node: Node): node is Node & { level: 1 | 2 | 3 | 4 | 5 | 6 } {
  return node.type === 'heading';
}

function isLink(node: Node): node is Node & { text?: string } {
  return node.type === 'link';
}

function isButton(node: Node): node is Node & { text?: string } {
  return node.type === 'button';
}

function isImage(node: Node): node is Node & { alt: string } {
  return node.type === 'image';
}

function isBlank(text: string | undefined): boolean {
  return text === undefined || text.trim() === '';
}

// Parse a #RRGGBB color to RGB. Returns null for anything else (3-digit hex,
// named colors, var(...) references, ...) so the check is simply skipped.
function parseHex(color: string): { r: number; g: number; b: number } | null {
  const hex = color.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

// WCAG contrast ratio: (L1 + 0.05) / (L2 + 0.05), lighter over darker.
function contrastRatio(
  fore: { r: number; g: number; b: number },
  back: { r: number; g: number; b: number },
): number {
  const l1 = relativeLuminance(fore);
  const l2 = relativeLuminance(back);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// Resolve a Length at the desktop breakpoint to px. px = value, rem = value * 16.
// Other units (em, pct, vh, vw, token, auto) can't be resolved statically.
function resolveLengthPx(length: Length | undefined): number | undefined {
  if (!length) return undefined;
  if (length.kind === 'px') return length.value;
  if (length.kind === 'rem') return length.value * 16;
  return undefined;
}

/** Walk every node in document order, collecting matches of a predicate. */
function walkMatches(
  nodes: Record<NodeId, Node>,
  rootIds: NodeId[],
  pred: (node: Node) => boolean,
): Node[] {
  const found: Node[] = [];
  const seen = new Set<NodeId>();
  const walk = (id: NodeId) => {
    const node = nodes[id];
    if (!node || seen.has(id)) return;
    seen.add(id);
    if (pred(node)) found.push(node);
    for (const child of node.children) walk(child);
  };
  for (const id of rootIds) walk(id);
  return found;
}

export function runPreExportChecks(
  project: Project,
  nodes: Record<NodeId, Node>,
): PreExportResult {
  const errors: CheckItem[] = [];
  const warnings: CheckItem[] = [];

  // --- Page-level checks ---

  const slugs = new Map<string, NodeId[]>();
  for (const page of project.pages) {
    const group = slugs.get(page.slug) ?? [];
    group.push(page.id);
    slugs.set(page.slug, group);

    if (isBlank(page.title)) {
      errors.push({
        id: EMPTY_TITLE,
        message: `Page "${page.slug}" has no title.`,
        nodeId: null,
        type: 'error',
      });
    }
    if (isBlank(page.slug)) {
      errors.push({
        id: DUPLICATE_SLUG,
        message: `Page "${page.id}" has no slug.`,
        nodeId: null,
        type: 'error',
      });
    }

    const meta = page.metaDescription;
    if (!meta || meta.trim() === '') {
      warnings.push({
        id: META_DESCRIPTION_MISSING,
        message: `Page "${page.slug}" has no meta description.`,
        nodeId: null,
        type: 'warning',
      });
    } else if (meta.length < META_DESCRIPTION_MIN_CHARS) {
      warnings.push({
        id: META_DESCRIPTION_TOO_SHORT,
        message: `Page "${page.slug}" meta description is too short (${meta.length} characters; minimum ${META_DESCRIPTION_MIN_CHARS}).`,
        nodeId: null,
        type: 'warning',
      });
    } else if (meta.length > META_DESCRIPTION_MAX_CHARS) {
      warnings.push({
        id: META_DESCRIPTION_TOO_LONG,
        message: `Page "${page.slug}" meta description is too long (${meta.length} characters; maximum ${META_DESCRIPTION_MAX_CHARS}).`,
        nodeId: null,
        type: 'warning',
      });
    }
  }

  for (const [slug, ids] of slugs) {
    if (ids.length > 1) {
      errors.push({
        id: DUPLICATE_SLUG,
        message: `Duplicate slug "${slug}" on ${ids.length} pages.`,
        nodeId: null,
        type: 'error',
      });
    }
  }

  // Collect every page root and its subtree.
  const pageRootIds = project.pages
    .map((p) => p.rootId)
    .filter((id): id is NodeId => Boolean(id) && Boolean(nodes[id]));

  // --- Node-level checks (per page) ---

  for (const rootId of pageRootIds) {
    const nodesInPage = walkMatches(nodes, [rootId], () => true);

    // Images without alt; links/buttons with no accessible name.
    for (const node of nodesInPage) {
      if (isImage(node) && isBlank(node.alt)) {
        warnings.push({
          id: IMAGE_NO_ALT,
          message: `Image has no alt text.`,
          nodeId: node.id,
          type: 'warning',
        });
      }

      if ((isLink(node) || isButton(node)) && isBlank(node.text)) {
        warnings.push({
          id: NO_ACCESSIBLE_NAME,
          message: `${node.type} has no accessible name.`,
          nodeId: node.id,
          type: 'warning',
        });
      }

      // Text-node checks: font family, color contrast, body text size.
      if (TEXT_NODE_TYPES.has(node.type)) {
        const fontFamily = resolveResponsive('desktop', node.styles.fontFamily);
        if (isBlank(fontFamily)) {
          warnings.push({
            id: MISSING_FONT,
            message: `${node.type} "${node.id}" has no font family set.`,
            nodeId: node.id,
            type: 'warning',
          });
        }

        const foreground = resolveResponsive('desktop', node.styles.color);
        const background = resolveResponsive('desktop', node.styles.backgroundColor);
        if (foreground && background) {
          const fg = parseHex(foreground);
          const bg = parseHex(background);
          if (fg && bg) {
            const ratio = contrastRatio(fg, bg);
            if (ratio < MIN_CONTRAST_RATIO) {
              warnings.push({
                id: LOW_CONTRAST,
                message: `${node.type} "${node.id}" contrast ratio ${ratio.toFixed(2)}:1 is below ${MIN_CONTRAST_RATIO}:1.`,
                nodeId: node.id,
                type: 'warning',
              });
            }
          }
        }
      }

      if (BODY_TEXT_NODE_TYPES.has(node.type)) {
        const sizePx = resolveLengthPx(resolveResponsive('desktop', node.styles.fontSize));
        if (sizePx !== undefined && sizePx < MIN_BODY_FONT_SIZE_PX) {
          warnings.push({
            id: TEXT_SIZE_TOO_SMALL,
            message: `${node.type} "${node.id}" is ${sizePx}px, below the ${MIN_BODY_FONT_SIZE_PX}px minimum.`,
            nodeId: node.id,
            type: 'warning',
          });
        }
      }
    }

    // Headings in document order for H1 count and level-skip checks.
    const headings = nodesInPage.filter(isHeading);
    const h1Count = headings.filter((h) => h.level === 1).length;
    if (h1Count === 0) {
      warnings.push({
        id: ZERO_H1,
        message: 'Page has no H1 heading.',
        nodeId: null,
        type: 'warning',
      });
    } else if (h1Count > 1) {
      warnings.push({
        id: MULTIPLE_H1,
        message: 'Page has more than one H1 heading.',
        nodeId: null,
        type: 'warning',
      });
    }

    let lastHeadingLevel: number | null = null;
    for (const heading of headings) {
      if (lastHeadingLevel !== null && heading.level - lastHeadingLevel > 1) {
        warnings.push({
          id: HEADING_SKIP,
          message: `Heading skips from h${lastHeadingLevel} to h${heading.level}.`,
          nodeId: heading.id,
          type: 'warning',
        });
      }
      lastHeadingLevel = heading.level;
    }
  }

  return { errors, warnings };
}
