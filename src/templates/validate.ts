// src/templates/validate.ts
// Roux Studio — template validation (M4 Job 7).
//
// validateTemplate(input) returns a list of human-readable problems; an empty
// array means valid. Unknown-typed input is reported, never thrown. Checks run
// in spec order: shape → flat-map integrity → containment → pages → globals →
// token references → copy → widths.

import type { Node, NodeId } from '../types';
import { CONTAINMENT_RULES } from '../store/containment';

const ALLOWED_PHONE = '+27 00 000 0000';
const PHONE_RUN = /(?:\+27[\s-]*)?\d([\s-]*\d){8,}/;
const LOREM = /lorem|ipsum/i;
const VAR_REF = /var\(--([^)]+)\)/g;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

export function validateTemplate(input: unknown): string[] {
  const problems: string[] = [];

  // ── 1. shape ──────────────────────────────────────────────────────────
  if (!isPlainObject(input)) {
    problems.push('Template must be a JSON object.');
    return problems;
  }
  const p = input;

  if (!isString(p.id)) problems.push('Template is missing a string "id".');
  if (!isString(p.name)) problems.push('Template is missing a string "name".');
  if (!Array.isArray(p.pages) || p.pages.length === 0) {
    problems.push('Template must have a non-empty "pages" array.');
  }
  if (!isPlainObject(p.tokens) || !isPlainObject(p.tokens.byName)) {
    problems.push('Template must have "tokens.byName" object.');
  }
  if (!isPlainObject(p.nodes)) {
    problems.push('Template must have a "nodes" object.');
  }
  if (!Array.isArray(p.blocks)) {
    problems.push('Template must have a "blocks" array.');
  }
  if (!(p.globalHeaderId === null || isString(p.globalHeaderId))) {
    problems.push('Template "globalHeaderId" must be a string or null.');
  }
  if (!(p.globalFooterId === null || isString(p.globalFooterId))) {
    problems.push('Template "globalFooterId" must be a string or null.');
  }

  const nodes = p.nodes as Record<NodeId, Node> | undefined;
  const pages = p.pages as Array<{ id?: unknown; rootId?: unknown }> | undefined;
  const blocks = p.blocks as Array<{ rootId?: unknown; nodes?: unknown }> | undefined;
  const byName = (p.tokens as { byName?: unknown } | undefined)?.byName as
    | Record<string, unknown>
    | undefined;

  if (!nodes || !pages || !byName || !blocks) {
    return problems;
  }

  const nodeIds = new Set(Object.keys(nodes));
  const pageChildIds = new Set<NodeId>(); // direct children of any page root

  // ── 2. flat-map integrity ─────────────────────────────────────────────
  for (const [id, node] of Object.entries(nodes)) {
    if (node.id !== id) {
      problems.push(`Node key "${id}" does not match node.id "${node.id}".`);
    }
    for (const childId of node.children) {
      if (!nodeIds.has(childId)) {
        problems.push(`Node "${id}" references missing child "${childId}".`);
      } else {
        const child = nodes[childId]!;
        if (child.parentId !== id) {
          problems.push(
            `Child "${childId}" of "${id}" has parentId "${child.parentId}", expected "${id}".`,
          );
        }
      }
      pageChildIds.add(childId);
    }
  }

  // No node reachable from itself (cycle).
  for (const startId of Object.keys(nodes)) {
    const seen = new Set<NodeId>();
    const stack: NodeId[] = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const node = nodes[id];
      if (!node) continue;
      for (const childId of node.children) {
        if (childId === startId) {
          problems.push(`Node "${startId}" is reachable from itself (cycle).`);
        }
        stack.push(childId);
      }
    }
  }

  // ── 3. containment ────────────────────────────────────────────────────
  for (const [parentId, node] of Object.entries(nodes)) {
    const allowed = CONTAINMENT_RULES[node.type as keyof typeof CONTAINMENT_RULES];
    if (!allowed) continue;
    for (const childId of node.children) {
      const child = nodes[childId];
      if (!child) continue;
      if (!allowed.has(child.type)) {
        problems.push(
          `Node "${parentId}" (${node.type}) cannot contain "${childId}" (${child.type}).`,
        );
      }
    }
  }

  // ── 4. pages ──────────────────────────────────────────────────────────
  for (const page of pages) {
    const rootId = isString(page.rootId) ? page.rootId : undefined;
    if (!rootId || !nodeIds.has(rootId)) {
      problems.push(`Page "${isString(page.id) ? page.id : '?'}" references missing root "${rootId}".`);
      continue;
    }
    const root = nodes[rootId]!;
    if (root.type !== 'page') {
      problems.push(`Page root "${rootId}" is not of type "page".`);
    }
    for (const childId of root.children) {
      const child = nodes[childId];
      if (!child) continue;
      if (!CONTAINMENT_RULES.page.has(child.type)) {
        problems.push(
          `Page root "${rootId}" contains "${childId}" (${child.type}); expected section, nav, footer or componentInstance.`,
        );
      }
    }
  }

  // ── 5. globals ────────────────────────────────────────────────────────
  for (const [label, id] of [
    ['globalHeaderId', p.globalHeaderId],
    ['globalFooterId', p.globalFooterId],
  ] as const) {
    if (id === null) continue;
    if (!isString(id) || !nodeIds.has(id)) {
      problems.push(`${label} "${id}" does not reference an existing node.`);
      continue;
    }
    const node = nodes[id]!;
    if (node.parentId !== null) {
      problems.push(`${label} "${id}" must have parentId null, found "${node.parentId}".`);
    }
    if (pageChildIds.has(id)) {
      problems.push(`${label} "${id}" must not be a direct child of any page.`);
    }
  }

  // ── 6. token references ───────────────────────────────────────────────
  const refs: string[] = [];

  const collect = (value: unknown): void => {
    if (value === null || value === undefined) return;
    if (isString(value)) {
      for (const m of value.matchAll(VAR_REF)) {
        const name = m[1];
        if (name) refs.push(name);
      }
      return;
    }
    if (typeof value !== 'object') return;
    const obj = value as Record<string, unknown>;
    if (obj.kind === 'token' && isString(obj.token)) {
      refs.push(obj.token);
    }
    if (Array.isArray(value)) {
      for (const v of value) collect(v);
    } else {
      for (const v of Object.values(value)) collect(v);
    }
  };

  for (const node of Object.values(nodes)) {
    for (const responsive of Object.values(node.styles)) {
      if (!responsive) continue;
      for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
        collect((responsive as Record<string, unknown>)[bp]);
      }
    }
    for (const layer of (node as { backgroundLayers?: unknown[] }).backgroundLayers ?? []) {
      collect(layer);
    }
  }

  for (const ref of refs) {
    if (!(ref in byName)) {
      problems.push(`Template references unknown token "${ref}".`);
    }
  }

  // ── 7. copy ───────────────────────────────────────────────────────────
  const textKinds = new Set(['heading', 'paragraph', 'button', 'link', 'richText']);
  for (const node of Object.values(nodes)) {
    if (!textKinds.has(node.type)) continue;
    const textNode = node as { text?: unknown };
    const text = isString(textNode.text) ? (textNode.text as string) : '';
    if (LOREM.test(text)) {
      problems.push(`Node "${node.id}" contains lorem/ipsum copy.`);
    }
    const withoutAllowed = text.split(ALLOWED_PHONE).join('');
    if (PHONE_RUN.test(withoutAllowed)) {
      problems.push(`Node "${node.id}" contains a phone-looking number.`);
    }
  }

  // ── 8. widths ─────────────────────────────────────────────────────────
  const BAD_WIDTHS = new Set([1440, 768, 390]);
  for (const node of Object.values(nodes)) {
    const width = (node.styles as { width?: { desktop?: unknown } }).width?.desktop;
    if (
      width &&
      typeof width === 'object' &&
      !Array.isArray(width) &&
      (width as { kind?: unknown; value?: unknown }).kind === 'px' &&
      BAD_WIDTHS.has((width as { value?: number }).value as number)
    ) {
      problems.push(
        `Node "${node.id}" uses a fixed ${(width as { value: number }).value}px desktop width; use auto or a token instead.`,
      );
    }
  }

  return problems;
}
