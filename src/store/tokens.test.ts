// src/store/tokens.test.ts
// Token store actions: add/update/rename/delete, undo, and tokenUsage (M4 Job 3, step 1).
import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore, tokenUsage } from './useEditorStore';
import type { DesignToken, Node, NodeId } from '../types';
import { emptyEditorData } from '../types';

const get = () => useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState({
    ...emptyEditorData(),
    zoom: 1,
    readOnly: false,
    remoteRevision: 0,
    history: [],
    historyIndex: -1,
    isBatching: false,
    pendingForward: [],
    pendingInverse: [],
    clipboard: null,
  });
});

function lengthToken(name: string, value = '1rem'): DesignToken {
  return { name, value, type: 'length' };
}

function colorToken(name: string, value = '#0f766e'): DesignToken {
  return { name, value, type: 'color' };
}

function lengthRef(token: string) {
  return { kind: 'token' as const, value: 0, token };
}

function page(id: string, title: string) {
  return {
    id,
    type: 'page' as const,
    parentId: null,
    children: [],
    styles: {},
    hidden: {},
    locked: false,
    rootId: id,
    title,
    slug: title.toLowerCase(),
    backgroundLayers: [],
  };
}

function box(id: string, parentId: NodeId | null): Node {
  return {
    id,
    type: 'box' as const,
    parentId,
    children: [],
    styles: {},
    hidden: {},
    locked: false,
  };
}

function resetWith(pages: ReturnType<typeof page>[], nodes: Record<string, Node>, tokens: Record<string, DesignToken>) {
  get().reset({
    ...emptyEditorData(),
    pages,
    tokens: { byName: tokens },
    nodes,
    currentPageId: pages[0]?.id ?? null,
  });
}

describe('token store actions', () => {
  it('addToken adds and updateToken revises a token; unknown names are no-ops', () => {
    get().addToken(lengthToken('space-4'));
    expect(get().tokens.byName['space-4']).toEqual({
      name: 'space-4',
      value: '1rem',
      type: 'length',
    });

    get().updateToken('space-4', '2rem');
    expect(get().tokens.byName['space-4']!.value).toBe('2rem');

    get().updateToken('missing', 'x');
    expect(get().tokens.byName['missing']).toBeUndefined();
  });

  it('renameToken updates refs on nodes from two pages and renames byName', () => {
    const a = page('page-a', 'Page A');
    const b = page('page-b', 'Page B');
    const boxA = box('box-a', 'page-a');
    const boxB = box('box-b', 'page-b');
    const heading = box('heading', 'page-a');
    boxA.styles = { margin: { desktop: lengthRef('space-4') } };
    boxB.styles = {
      padding: { desktop: lengthRef('space-4'), tablet: lengthRef('space-4') },
    };
    heading.styles = { color: { desktop: 'var(--color-primary)' } };

    resetWith(
      [a, b],
      { [a.id]: a, [b.id]: b, [boxA.id]: boxA, [boxB.id]: boxB, [heading.id]: heading },
      { 'space-4': lengthToken('space-4'), 'color-primary': colorToken('color-primary') },
    );

    get().renameToken('space-4', 'gap-4');

    expect(get().tokens.byName['space-4']).toBeUndefined();
    expect(get().tokens.byName['gap-4']).toEqual({
      name: 'gap-4',
      value: '1rem',
      type: 'length',
    });
    expect(get().nodes['box-a']!.styles.margin?.desktop?.token).toBe('gap-4');
    expect(get().nodes['box-b']!.styles.padding?.desktop?.token).toBe('gap-4');
    expect(get().nodes['box-b']!.styles.padding?.tablet?.token).toBe('gap-4');
    // Colour refs to an unrelated token are untouched by a length-token rename.
    expect(get().nodes['heading']!.styles.color?.desktop).toBe('var(--color-primary)');

    expect(tokenUsage(get().nodes, 'gap-4')).toBe(2);
    expect(tokenUsage(get().nodes, 'space-4')).toBe(0);
  });

  it('renameToken renames colour tokens and updates var(--...) refs', () => {
    const a = page('page-a', 'Page A');
    const boxA = box('box-a', 'page-a');
    boxA.styles = { color: { desktop: 'var(--color-primary)' } };

    resetWith(
      [a],
      { [a.id]: a, [boxA.id]: boxA },
      { 'color-primary': colorToken('color-primary') },
    );

    get().renameToken('color-primary', 'color-brand');

    expect(get().tokens.byName['color-primary']).toBeUndefined();
    expect(get().tokens.byName['color-brand']!.name).toBe('color-brand');
    expect(get().nodes[boxA.id]!.styles.color?.desktop).toBe('var(--color-brand)');
    expect(tokenUsage(get().nodes, 'color-brand')).toBe(1);
  });

  it('one undo() reverses a rename fully', () => {
    const a = page('page-a', 'Page A');
    const boxA = box('box-a', 'page-a');
    boxA.styles = { margin: { desktop: lengthRef('space-4') } };

    resetWith(
      [a],
      { [a.id]: a, [boxA.id]: boxA },
      { 'space-4': lengthToken('space-4') },
    );

    expect(get().canUndo()).toBe(false);
    get().renameToken('space-4', 'gap-4');
    expect(get().canUndo()).toBe(true);

    get().undo();

    expect(get().canUndo()).toBe(false);
    expect(get().tokens.byName['space-4']).toEqual({
      name: 'space-4',
      value: '1rem',
      type: 'length',
    });
    expect(get().tokens.byName['gap-4']).toBeUndefined();
    expect(get().nodes['box-a']!.styles.margin?.desktop?.token).toBe('space-4');
    expect(tokenUsage(get().nodes, 'gap-4')).toBe(0);
    expect(tokenUsage(get().nodes, 'space-4')).toBe(1);
  });

  it('deleteToken with detach leaves raw values and no refs', () => {
    const a = page('page-a', 'Page A');
    const boxA = box('box-a', 'page-a');
    boxA.styles = {
      margin: { desktop: lengthRef('space-4') },
      color: { desktop: 'var(--color-primary)' },
    };

    resetWith(
      [a],
      { [a.id]: a, [boxA.id]: boxA },
      { 'space-4': lengthToken('space-4', '1rem'), 'color-primary': colorToken('color-primary', '#0f766e') },
    );

    get().deleteToken('space-4', 'detach');
    get().deleteToken('color-primary', 'detach');

    expect(get().tokens.byName['space-4']).toBeUndefined();
    expect(get().tokens.byName['color-primary']).toBeUndefined();
    expect(get().nodes['box-a']!.styles.margin?.desktop).toEqual({ kind: 'px', value: 1 });
    expect(get().nodes['box-a']!.styles.color?.desktop).toBe('#0f766e');
    expect(tokenUsage(get().nodes, 'space-4')).toBe(0);
    expect(tokenUsage(get().nodes, 'color-primary')).toBe(0);
  });

  it('deleteToken with replaceWith points refs at the new token', () => {
    const a = page('page-a', 'Page A');
    const boxA = box('box-a', 'page-a');
    const boxB = box('box-b', 'page-a');
    boxA.styles = { margin: { desktop: lengthRef('space-4') } };
    boxB.styles = { padding: { desktop: lengthRef('space-4') } };

    resetWith(
      [a],
      { [a.id]: a, [boxA.id]: boxA, [boxB.id]: boxB },
      { 'space-4': lengthToken('space-4'), 'gap-4': lengthToken('gap-4') },
    );

    get().deleteToken('space-4', { replaceWith: 'gap-4' });

    expect(get().tokens.byName['space-4']).toBeUndefined();
    expect(get().tokens.byName['gap-4']).toBeDefined();
    expect(get().nodes['box-a']!.styles.margin?.desktop?.token).toBe('gap-4');
    expect(get().nodes['box-b']!.styles.padding?.desktop?.token).toBe('gap-4');
    expect(tokenUsage(get().nodes, 'gap-4')).toBe(2);
    expect(tokenUsage(get().nodes, 'space-4')).toBe(0);
  });

  it('tokenUsage counts nodes across pages, once per node', () => {
    const a = page('page-a', 'Page A');
    const b = page('page-b', 'Page B');
    const boxA = box('box-a', 'page-a');
    const boxB = box('box-b', 'page-b');
    boxA.styles = { margin: { desktop: lengthRef('space-4') } };
    boxB.styles = {
      padding: { desktop: lengthRef('space-4') },
      gap: { tablet: lengthRef('space-4') },
    };

    resetWith(
      [a, b],
      { [a.id]: a, [b.id]: b, [boxA.id]: boxA, [boxB.id]: boxB },
      { 'space-4': lengthToken('space-4') },
    );

    expect(tokenUsage(get().nodes, 'space-4')).toBe(2);
    expect(tokenUsage(get().nodes, 'gap-4')).toBe(0);
  });

  it('renameToken does nothing if newName already exists', () => {
    resetWith(
      [],
      {},
      { 'space-4': lengthToken('space-4'), 'gap-4': lengthToken('gap-4') },
    );

    get().renameToken('space-4', 'gap-4');

    expect(get().tokens.byName['space-4']).toBeDefined();
    expect(get().tokens.byName['gap-4']).toEqual({
      name: 'gap-4',
      value: '1rem',
      type: 'length',
    });
  });

  it('renameToken rewrites var(--oldName) inside other tokens\' values', () => {
    resetWith(
      [],
      {},
      {
        'space-4': lengthToken('space-4'),
        'gap-8': { name: 'gap-8', value: 'var(--space-4)', type: 'spacing' },
      },
    );

    get().renameToken('space-4', 'gap-4');

    expect(get().tokens.byName['space-4']).toBeUndefined();
    expect(get().tokens.byName['gap-4']!.value).toBe('1rem');
    expect(get().tokens.byName['gap-8']!.value).toBe('var(--gap-4)');
  });

  it('deleteToken rewrites var(--name) inside other tokens\' values', () => {
    resetWith(
      [],
      {},
      {
        'space-4': lengthToken('space-4', '1rem'),
        'gap-8': { name: 'gap-8', value: 'var(--space-4)', type: 'spacing' },
      },
    );

    get().deleteToken('space-4', 'detach');

    expect(get().tokens.byName['space-4']).toBeUndefined();
    expect(get().tokens.byName['gap-8']!.value).toBe('1rem');
  });
});
