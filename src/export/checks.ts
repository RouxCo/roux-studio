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
//             links/buttons with no accessible name.
//
// Size/contrast/font checks and meta-description checks need asset /
// page metadata that isn't on the Page type yet; they are deferred to a
// follow-up (logged in DECISIONS.md).

import type { Node, NodeId, Project } from '../types';

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
