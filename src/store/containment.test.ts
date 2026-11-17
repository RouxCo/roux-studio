// src/store/containment.test.ts
// Containment rules — what may nest inside what (spec §4.6).
// Plain vitest, no DOM needed.
import { describe, expect, it } from 'vitest';

import type { ElementType, Node, NodeId } from '../types';

import { assertCanContain, assertCanMove, ContainmentError } from './containment';

function node(
  id: NodeId,
  type: ElementType,
  parentId: NodeId | null = null,
  children: NodeId[] = [],
): Node {
  return {
    id,
    type,
    parentId,
    children,
    styles: {},
    hidden: {},
    locked: false,
  } as Node;
}

describe('containment rules', () => {
  it('allows a heading inside a container', () => {
    assertCanContain('container', 'heading');
  });

  it('allows a paragraph inside a box', () => {
    assertCanContain('box', 'paragraph');
  });

  it('allows a heading, paragraph and button inside a card', () => {
    assertCanContain('card', 'heading');
    assertCanContain('card', 'paragraph');
    assertCanContain('card', 'button');
  });

  it('allows a pricing table holding a card whose children are a heading and a paragraph', () => {
    const nodes: Record<NodeId, Node> = {
      'pt-1': node('pt-1', 'pricingTable', null, ['card-1']),
      'card-1': node('card-1', 'card', 'pt-1', ['h-1', 'p-1']),
      'h-1': node('h-1', 'heading', 'card-1'),
      'p-1': node('p-1', 'paragraph', 'card-1'),
    };
    expect(() => assertCanMove(nodes, 'card-1', 'pt-1')).not.toThrow();
    assertCanContain('card', 'heading');
    assertCanContain('card', 'paragraph');
  });

  it('allows a paragraph inside a faq item', () => {
    assertCanContain('faqItem', 'paragraph');
  });

  it('rejects a faq item inside a faq item', () => {
    expect(() => assertCanContain('faqItem', 'faqItem')).toThrow(ContainmentError);
  });

  it('allows a container inside a section', () => {
    assertCanContain('section', 'container');
  });

  it('rejects a section inside a container', () => {
    expect(() => assertCanContain('container', 'section')).toThrow(ContainmentError);
  });

  it('rejects a nav inside a box', () => {
    expect(() => assertCanContain('box', 'nav')).toThrow(ContainmentError);
  });

  it('rejects a pricing table inside a card', () => {
    expect(() => assertCanContain('card', 'pricingTable')).toThrow(ContainmentError);
  });

  it('rejects a box at the page root', () => {
    const nodes: Record<NodeId, Node> = { 'box-1': node('box-1', 'box') };
    expect(() => assertCanMove(nodes, 'box-1', null)).toThrow(ContainmentError);
  });
});
