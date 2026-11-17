// src/store/containment.ts
// Roux Studio — containment rules for the editor node tree (spec §4.6, §7.1).
//
// addNode/moveNode must assert these rules before mutating the store so an
// illegal nest can never be committed as a history step. A rejected add/move
// throws ContainmentError and leaves the store untouched.

import type { ElementType, Node, NodeId } from '../types';

type Rule = ReadonlySet<ElementType>;

function rule(...types: ElementType[]): Rule {
  return new Set(types);
}

const NONE: Rule = new Set();

// nav and footer may only contain these directly.
const NAV_FOOTER_ALLOWED: Rule = rule(
  'container', 'link', 'button', 'image', 'icon', 'richText', 'paragraph',
);

// Every element type that can appear in the tree.
const ALL_TYPES: ElementType[] = [
  'page', 'section', 'container', 'box', 'heading', 'paragraph', 'richText',
  'button', 'link', 'image', 'icon', 'form', 'formField', 'faq', 'faqItem',
  'slider', 'slide', 'gallery', 'imageItem', 'pricingTable', 'card', 'nav',
  'footer', 'componentInstance',
];

// A section may hold anything except sections, navs or footers directly
// inside it. Pages stay at the root.
const SECTION_ALLOWED: Rule = new Set(
  ALL_TYPES.filter((t) => t !== 'section' && t !== 'nav' && t !== 'footer'),
);

// Containers, boxes, cards and slides hold page content directly; a pricing
// table is only valid inside a section.
const CONTENT_ALLOWED: Rule = new Set(
  ALL_TYPES.filter(
    (t) =>
      t !== 'page' &&
      t !== 'section' &&
      t !== 'nav' &&
      t !== 'footer' &&
      t !== 'componentInstance' &&
      t !== 'pricingTable',
  ),
);

export const CONTAINMENT_RULES: Record<ElementType, Rule> = {
  page: rule('section', 'nav', 'footer', 'componentInstance'),
  section: SECTION_ALLOWED,
  container: CONTENT_ALLOWED,
  box: CONTENT_ALLOWED,
  heading: NONE,
  paragraph: NONE,
  richText: NONE,
  button: NONE,
  link: NONE,
  image: NONE,
  icon: NONE,
  form: rule('formField', 'button', 'paragraph', 'heading', 'container', 'box'),
  formField: NONE,
  faq: rule('faqItem'),
  faqItem: rule('heading', 'paragraph', 'richText', 'button', 'link', 'image', 'icon'),
  slider: rule('slide'),
  slide: CONTENT_ALLOWED,
  gallery: rule('imageItem'),
  imageItem: NONE,
  pricingTable: rule('card'),
  card: CONTENT_ALLOWED,
  nav: NAV_FOOTER_ALLOWED,
  footer: NAV_FOOTER_ALLOWED,
  componentInstance: NONE,
};

// What may be added directly at the page root (parentId === null).
export const ROOT_ALLOWED: Rule = CONTAINMENT_RULES.page;

export class ContainmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContainmentError';
  }
}

export function assertCanContain(parentType: ElementType | 'root', childType: ElementType): void {
  const allowed: Rule | undefined =
    parentType === 'root' ? ROOT_ALLOWED : CONTAINMENT_RULES[parentType];
  if (!allowed?.has(childType)) {
    throw new ContainmentError(
      `Cannot nest ${childType} inside ${parentType === 'root' ? 'the page root' : parentType}.`,
    );
  }
}

export function collectDescendants(nodes: Record<NodeId, Node>, nodeId: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const stack: NodeId[] = [nodeId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = nodes[id];
    if (!node) continue;
    for (const childId of node.children) {
      out.push(childId);
      stack.push(childId);
    }
  }
  return out;
}

export function assertCanMove(nodes: Record<NodeId, Node>, nodeId: NodeId, parentId: NodeId | null): void {
  const node = nodes[nodeId];
  if (!node) return;

  if (parentId === nodeId) {
    throw new ContainmentError(`Cannot move ${node.id} (${node.type}) into itself.`);
  }

  if (parentId !== null) {
    const parent = nodes[parentId];
    if (!parent) {
      throw new ContainmentError(`Move target ${parentId} does not exist.`);
    }
    // Moving a node beneath one of its own descendants creates a cycle.
    if (collectDescendants(nodes, nodeId).includes(parentId)) {
      throw new ContainmentError(
        `Cannot move ${node.id} (${node.type}) into ${parentId} (${parent.type}): it is a descendant of ${node.id}.`,
      );
    }
    assertCanContain(parent.type, node.type);
  } else if (!ROOT_ALLOWED.has(node.type)) {
    throw new ContainmentError(`Cannot move ${node.id} (${node.type}) to the page root.`);
  }
}
