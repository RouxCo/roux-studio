// src/store/globals.test.ts
// Global header/footer: make/remove actions, per-page flags, undo steps
// and the globalOwner helper (M4 Job 6 step 3).
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { useEditorStore, globalOwner } from './useEditorStore';
import type { Node, NodeId, PageId } from '../types';
import { emptyEditorData } from '../types';

const get = () => useEditorStore.getState();

function pageNode(id: NodeId, children: NodeId[] = []): Node {
  return {
    id,
    type: 'page',
    parentId: null,
    children,
    styles: {},
    hidden: {},
    locked: false,
    title: id,
    slug: id,
    backgroundLayers: [],
    useGlobalHeader: false,
    useGlobalFooter: false,
  };
}

function page(id: PageId, rootId: NodeId, flags: { header?: boolean; footer?: boolean } = { header: false, footer: false }) {
  return {
    id,
    title: id,
    slug: id,
    rootId,
    useGlobalHeader: flags.header,
    useGlobalFooter: flags.footer,
  };
}

function section(id: NodeId, parentId: NodeId | null, children: NodeId[] = []): Node {
  return {
    id,
    type: 'section',
    parentId,
    children,
    styles: {},
    hidden: {},
    locked: false,
    backgroundLayers: [],
    sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  };
}

function container(id: NodeId, parentId: NodeId | null, children: NodeId[] = []): Node {
  return {
    id,
    type: 'container',
    parentId,
    children,
    styles: {},
    hidden: {},
    locked: false,
  };
}

function footer(id: NodeId, parentId: NodeId | null, children: NodeId[] = []): Node {
  return {
    id,
    type: 'footer',
    parentId,
    children,
    styles: {},
    hidden: {},
    locked: false,
  };
}

function heading(id: NodeId, parentId: NodeId): Node {
  return {
    id,
    type: 'heading',
    parentId,
    children: [],
    styles: {},
    hidden: {},
    locked: false,
    level: 1,
    text: 'Hello',
  };
}

function paragraph(id: NodeId, parentId: NodeId): Node {
  return {
    id,
    type: 'paragraph',
    parentId,
    children: [],
    styles: {},
    hidden: {},
    locked: false,
    text: 'Hello',
  };
}

function seedTwoPages() {
  useEditorStore.setState({
    ...emptyEditorData(),
    pages: [page('page-a', 'root-a'), page('page-b', 'root-b')],
    nodes: {
      'root-a': pageNode('root-a', ['sec-a']),
      'root-b': pageNode('root-b', ['sec-b']),
      'sec-a': section('sec-a', 'root-a'),
      'sec-b': section('sec-b', 'root-b'),
    },
    currentPageId: 'page-a',
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
}

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

describe('makeGlobalHeader', () => {
  it('takes a section out of its page, makes it global on every page, in one step', () => {
    seedTwoPages();
    get().makeGlobalHeader('sec-a');

    const state = get();
    expect(state.globalHeaderId).toBe('sec-a');
    expect(state.nodes['sec-a']!.parentId).toBeNull();
    expect(state.nodes['root-a']!.children).not.toContain('sec-a');
    for (const p of state.pages) expect(p.useGlobalHeader).toBe(true);
    expect(state.canUndo()).toBe(true);
    expect(state.historyIndex).toBe(0);
  });

  it('is one undo step: undo puts the section back on its page and restores the flags', () => {
    seedTwoPages();
    get().makeGlobalHeader('sec-a');
    get().undo();

    const state = get();
    expect(state.globalHeaderId).toBeNull();
    expect(state.nodes['sec-a']!.parentId).toBe('root-a');
    expect(state.nodes['root-a']!.children).toContain('sec-a');
    for (const p of state.pages) expect(p.useGlobalHeader).toBe(false);
    expect(state.canUndo()).toBe(false);
    expect(state.canRedo()).toBe(true);

    get().redo();
    expect(get().globalHeaderId).toBe('sec-a');
    expect(get().nodes['root-a']!.children).not.toContain('sec-a');
    for (const p of get().pages) expect(p.useGlobalHeader).toBe(true);
  });

  it('replacing the global header deletes the old subtree first', () => {
    seedTwoPages();
    get().makeGlobalHeader('sec-a');
    get().makeGlobalHeader('sec-b');

    const state = get();
    expect(state.globalHeaderId).toBe('sec-b');
    expect(state.nodes['sec-a']).toBeUndefined();
    expect(state.nodes['root-b']!.children).not.toContain('sec-b');
    expect(state.nodes['root-a']!.children).not.toContain('sec-a');
  });

  it('is a no-op unless the node is a section/nav/footer and a direct child of a page root', () => {
    seedTwoPages();
    useEditorStore.setState({ nodes: { ...get().nodes, 'h-a': heading('h-a', 'sec-a') } });

    get().makeGlobalHeader('h-a'); // heading: not an allowed type
    expect(get().globalHeaderId).toBeNull();
    // A no-op recipe still records an (empty) updateData step, like the other store actions.
    expect(get().historyIndex).toBe(0);

    get().makeGlobalHeader('sec-a');
    expect(get().globalHeaderId).toBe('sec-a');
    expect(get().historyIndex).toBe(1);

    get().makeGlobalHeader('sec-a'); // already the global: no further change
    expect(get().globalHeaderId).toBe('sec-a');
    expect(get().historyIndex).toBe(2);
  });
});

describe('makeGlobalFooter', () => {
  it('makes a footer global on every page in one step', () => {
    seedTwoPages();
    get().makeGlobalFooter('sec-b');

    const state = get();
    expect(state.globalFooterId).toBe('sec-b');
    expect(state.nodes['sec-b']!.parentId).toBeNull();
    expect(state.nodes['root-b']!.children).not.toContain('sec-b');
    for (const p of state.pages) expect(p.useGlobalFooter).toBe(true);
    expect(state.historyIndex).toBe(0);
  });
});

describe('removeGlobalHeader / removeGlobalFooter', () => {
  it('deletes the global subtree, nulls the id, and leaves the page flags alone', () => {
    seedTwoPages();
    get().makeGlobalHeader('sec-a');
    get().makeGlobalFooter('sec-b');
    expect(get().pages.every((p) => p.useGlobalHeader && p.useGlobalFooter)).toBe(true);

    get().removeGlobalHeader();

    const state = get();
    expect(state.globalHeaderId).toBeNull();
    expect(state.nodes['sec-a']).toBeUndefined();
    expect(state.globalFooterId).toBe('sec-b');
    for (const p of state.pages) {
      expect(p.useGlobalHeader).toBe(true);
      expect(p.useGlobalFooter).toBe(true);
    }
  });

  it('is a no-op when there is no global', () => {
    seedTwoPages();
    get().removeGlobalHeader();
    expect(get().globalHeaderId).toBeNull();
    expect(get().historyIndex).toBe(0); // empty updateData step, like other no-op actions
  });
});

describe('setPageGlobals', () => {
  it('sets the flags on one page only', () => {
    seedTwoPages();
    get().setPageGlobals('page-a', { header: true });
    get().setPageGlobals('page-b', { footer: true });

    const a = get().pages.find((p) => p.id === 'page-a')!;
    const b = get().pages.find((p) => p.id === 'page-b')!;
    expect(a.useGlobalHeader).toBe(true);
    expect(a.useGlobalFooter).toBe(false);
    expect(b.useGlobalHeader).toBe(false);
    expect(b.useGlobalFooter).toBe(true);

    get().setPageGlobals('page-a', { footer: true });
    expect(get().pages.find((p) => p.id === 'page-a')!.useGlobalHeader).toBe(true);
  });
});

describe('globalOwner', () => {
  it('finds the header for the global root and its deep descendants', () => {
    useEditorStore.setState({
      ...emptyEditorData(),
      nodes: {
        'head-1': section('head-1', null, ['box-h']),
        'box-h': container('box-h', 'head-1', ['h-h']),
        'h-h': heading('h-h', 'box-h'),
        'foot-1': footer('foot-1', null, ['p-f']),
        'p-f': paragraph('p-f', 'foot-1'),
        'page-1': pageNode('page-1', []),
      },
      globalHeaderId: 'head-1',
      globalFooterId: 'foot-1',
    });

    expect(globalOwner(get().nodes, 'head-1', 'head-1', 'foot-1')).toBe('header');
    expect(globalOwner(get().nodes, 'box-h', 'head-1', 'foot-1')).toBe('header');
    expect(globalOwner(get().nodes, 'h-h', 'head-1', 'foot-1')).toBe('header');
    expect(globalOwner(get().nodes, 'foot-1', 'head-1', 'foot-1')).toBe('footer');
    expect(globalOwner(get().nodes, 'p-f', 'head-1', 'foot-1')).toBe('footer');
    expect(globalOwner(get().nodes, 'page-1', 'head-1', 'foot-1')).toBeNull();
    expect(globalOwner(get().nodes, 'missing', 'head-1', 'foot-1')).toBeNull();
  });

  it('returns null when neither global exists', () => {
    useEditorStore.setState({
      ...emptyEditorData(),
      nodes: { 'sec-1': section('sec-1', null) },
      globalHeaderId: null,
      globalFooterId: null,
    });
    expect(globalOwner(get().nodes, 'sec-1', null, null)).toBeNull();
  });
});
