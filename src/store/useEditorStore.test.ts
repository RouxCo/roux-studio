// src/store/useEditorStore.test.ts
// Editor store tests: undo/redo, the 200-step cap, beginBatch/endBatch
// coalescing, and UI-state-not-tracked (spec §6.4).
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { useEditorStore } from './useEditorStore';
import type { BoxNode, Node, NodeId, PageNode, SectionNode } from '../types';
import { emptyEditorData } from '../types';
import { ContainmentError } from './containment';

const get = () => useEditorStore.getState();

function box(id: NodeId, parentId: NodeId | null = null): BoxNode {
  return {
    id,
    type: 'box',
    parentId,
    children: [],
    styles: {},
    hidden: {},
    locked: false,
  };
}

function heading(id: NodeId, parentId: NodeId | null = null): Node {
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

function section(id: NodeId, parentId: NodeId | null = null): SectionNode {
  return {
    id,
    type: 'section',
    parentId,
    children: [],
    styles: {},
    hidden: {},
    locked: false,
    backgroundLayers: [],
    sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  };
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

describe('undo/redo', () => {
  it('starts with an empty history and cannot undo or redo', () => {
    expect(get().canUndo()).toBe(false);
    expect(get().canRedo()).toBe(false);
    expect(get().historyIndex).toBe(-1);
    expect(get().history).toHaveLength(0);
  });

  it('records one history step per updateData and undoes/redoes it', () => {
    get().setProjectName('Alpha');
    expect(get().canUndo()).toBe(true);
    expect(get().canRedo()).toBe(false);
    expect(get().historyIndex).toBe(0);
    expect(get().projectName).toBe('Alpha');

    get().setProjectName('Beta');
    expect(get().historyIndex).toBe(1);
    expect(get().projectName).toBe('Beta');

    get().undo();
    expect(get().projectName).toBe('Alpha');
    expect(get().historyIndex).toBe(0);
    expect(get().canRedo()).toBe(true);

    get().undo();
    expect(get().projectName).toBe('Untitled');
    expect(get().historyIndex).toBe(-1);
    expect(get().canUndo()).toBe(false);

    get().redo();
    expect(get().projectName).toBe('Alpha');
    expect(get().historyIndex).toBe(0);

    get().redo();
    expect(get().projectName).toBe('Beta');
    expect(get().historyIndex).toBe(1);
    expect(get().canRedo()).toBe(false);
  });

  it('clears the redo stack when a new action follows an undo', () => {
    get().setProjectName('Alpha');
    get().setProjectName('Beta');
    get().undo();
    expect(get().canRedo()).toBe(true);
    expect(get().projectName).toBe('Alpha');

    get().setProjectName('Gamma');
    expect(get().canRedo()).toBe(false);
    expect(get().projectName).toBe('Gamma');
    expect(get().historyIndex).toBe(1);
  });

  it('reverts and reapplies node mutations through undo/redo', () => {
    get().addNode(section('sec-1'), null);
    get().addNode(box('n-1'), 'sec-1');
    expect(get().nodes).toHaveProperty('n-1');
    expect(get().nodes['n-1']?.locked).toBe(false);
    expect(get().canUndo()).toBe(true);

    get().patchNode('n-1', (draft) => {
      draft.locked = true;
    });
    expect(get().nodes['n-1']?.locked).toBe(true);
    expect(get().historyIndex).toBe(2);

    get().undo();
    expect(get().nodes['n-1']?.locked).toBe(false);
    expect(get().historyIndex).toBe(1);

    get().undo();
    expect(get().nodes).not.toHaveProperty('n-1');
    expect(get().nodes).toHaveProperty('sec-1');
    expect(get().historyIndex).toBe(0);
    expect(get().canUndo()).toBe(true);

    get().undo();
    expect(get().nodes).not.toHaveProperty('sec-1');
    expect(get().historyIndex).toBe(-1);
    expect(get().canUndo()).toBe(false);

    get().redo();
    expect(get().nodes).toHaveProperty('sec-1');
    expect(get().nodes).not.toHaveProperty('n-1');
    expect(get().nodes['sec-1']?.locked).toBe(false);
    expect(get().historyIndex).toBe(0);

    get().redo();
    expect(get().nodes).toHaveProperty('n-1');
    expect(get().nodes['n-1']?.locked).toBe(false);
    expect(get().historyIndex).toBe(1);

    get().redo();
    expect(get().nodes['n-1']?.locked).toBe(true);
    expect(get().historyIndex).toBe(2);
    expect(get().canRedo()).toBe(false);
  });
});

describe('history cap (200 steps)', () => {
  it('drops the oldest step once the cap is exceeded', () => {
    for (let i = 0; i < 250; i++) {
      get().setProjectName(`step-${i}`);
    }
    expect(get().history).toHaveLength(200);
    expect(get().historyIndex).toBe(199);
    expect(get().projectName).toBe('step-249');
    expect(get().canUndo()).toBe(true);
    expect(get().canRedo()).toBe(false);

    get().undo();
    expect(get().projectName).toBe('step-248');
    expect(get().historyIndex).toBe(198);
    expect(get().canRedo()).toBe(true);
  });
});

describe('beginBatch / endBatch coalescing', () => {
  it('coalesces multiple batched updateData calls into a single history step', () => {
    get().beginBatch();
    expect(get().isBatching).toBe(true);
    expect(get().canUndo()).toBe(false);

    get().setProjectName('Alpha');
    get().setProjectName('Beta');
    get().addPage({ id: 'p-1', title: 'Page 1', slug: 'page-1', rootId: 'root-1' });
    expect(get().canUndo()).toBe(false);
    expect(get().history).toHaveLength(0);

    get().endBatch();
    expect(get().isBatching).toBe(false);
    expect(get().history).toHaveLength(1);
    expect(get().historyIndex).toBe(0);
    expect(get().canUndo()).toBe(true);
    expect(get().canRedo()).toBe(false);

    get().undo();
    expect(get().projectName).toBe('Untitled');
    expect(get().pages).toHaveLength(0);
    expect(get().currentPageId).toBeNull();
    expect(get().canUndo()).toBe(false);
    expect(get().canRedo()).toBe(true);

    get().redo();
    expect(get().projectName).toBe('Beta');
    expect(get().pages).toHaveLength(1);
    expect(get().historyIndex).toBe(0);
  });

  it('records separate steps when updateData is not batched', () => {
    get().setProjectName('Alpha');
    get().setProjectName('Beta');
    expect(get().history).toHaveLength(2);
    expect(get().historyIndex).toBe(1);
  });
});

describe('UI state is not history-tracked', () => {
  it('does not create history steps for breakpoint, selection or zoom', () => {
    get().setBreakpoint('tablet');
    get().setSelection(['n-1']);
    get().setZoom(1.5);

    expect(get().breakpoint).toBe('tablet');
    expect(get().selection).toEqual(['n-1']);
    expect(get().zoom).toBe(1.5);
    expect(get().canUndo()).toBe(false);
    expect(get().canRedo()).toBe(false);
    expect(get().historyIndex).toBe(-1);
    expect(get().history).toHaveLength(0);

    // A UI change followed by undo must not touch UI state.
    get().setProjectName('Alpha');
    get().undo();
    expect(get().breakpoint).toBe('tablet');
    expect(get().selection).toEqual(['n-1']);
    expect(get().zoom).toBe(1.5);
    expect(get().projectName).toBe('Untitled');
  });
});

describe('containment — addNode / moveNode reject illegal nests', () => {
  it('adds an allowed child to the page root', () => {
    get().addNode(section('sec-1'), null);

    expect(get().nodes).toHaveProperty('sec-1');
    expect(get().nodes['sec-1']?.parentId).toBeNull();
  });

  it('rejects adding a section under a section', () => {
    get().addNode(section('sec-1'), null);
    expect(() => get().addNode(section('sec-2'), 'sec-1')).toThrow(ContainmentError);
    expect(get().nodes).not.toHaveProperty('sec-2');
  });

  it('rejects adding nav and footer under a section', () => {
    get().addNode(section('sec-1'), null);
    expect(() => get().addNode({ ...box('nav-1'), type: 'nav', children: [] }, 'sec-1')).toThrow(
      ContainmentError,
    );
    expect(() => get().addNode({ ...box('foot-1'), type: 'footer', children: [] }, 'sec-1')).toThrow(
      ContainmentError,
    );
    expect(get().nodes).not.toHaveProperty('nav-1');
    expect(get().nodes).not.toHaveProperty('foot-1');
  });

  it('allows a container directly under a form and under nav/footer', () => {
    get().addNode(section('sec-1'), null);
    const form = {
      id: 'form-1', type: 'form' as const, parentId: null, children: [], styles: {}, hidden: {}, locked: false,
      action: '/submit', method: 'post' as const,
    };
    get().addNode(form, 'sec-1');
    const formField = { id: 'ff-1', type: 'formField', parentId: null, children: [], styles: {}, hidden: {}, locked: false };
    get().addNode(formField as any, 'form-1');
    expect(get().nodes).toHaveProperty('ff-1');
    expect(get().nodes['ff-1']?.parentId).toBe('form-1');

    get().addNode({ ...box('nav-1'), type: 'nav', children: [] }, null);
    get().addNode(
      { id: 'box-in-nav', type: 'container', parentId: null, children: [], styles: {}, hidden: {}, locked: false },
      'nav-1',
    );
    expect(get().nodes).toHaveProperty('box-in-nav');
    expect(get().nodes['box-in-nav']?.parentId).toBe('nav-1');
  });

  it('rejects adding a node whose parent does not exist', () => {
    expect(() => get().addNode(box('orphan'), 'nope')).toThrow(ContainmentError);
    expect(get().nodes).not.toHaveProperty('orphan');
  });

  it('allows faqItem under faq but rejects faqItem under faqItem', () => {
    get().addNode(section('sec-1'), null);
    const faq = { id: 'faq-1', type: 'faq', parentId: null, children: [], styles: {}, hidden: {}, locked: false };
    const item = { id: 'item-1', type: 'faqItem', parentId: null, children: [], styles: {}, hidden: {}, locked: false, question: 'Q', answer: 'A' };
    get().addNode(faq as any, 'sec-1');
    get().addNode(item as any, 'faq-1');
    expect(get().nodes).toHaveProperty('item-1');
    expect(() => get().addNode({ ...item, id: 'item-2' } as any, 'item-1')).toThrow(ContainmentError);
  });

  it('moves a root-eligible section to the page root', () => {
    get().addNode(section('sec-1'), null);
    get().addNode(section('sec-2'), null);
    expect(() => get().moveNode('sec-1', null)).not.toThrow();
    expect(get().nodes['sec-1']?.parentId).toBeNull();
  });

  it('rejects moving a non-root-eligible box to the page root', () => {
    get().addNode(section('sec-1'), null);
    get().addNode(box('box-1'), 'sec-1');
    expect(() => get().moveNode('box-1', null)).toThrow(ContainmentError);
    expect(get().nodes['box-1']?.parentId).toBe('sec-1');
  });

  it('rejects moving a node into its own descendant (cycle)', () => {
    get().addNode(section('sec-1'), null);
    get().addNode(box('box-1'), 'sec-1');
    expect(() => get().moveNode('sec-1', 'box-1')).toThrow(ContainmentError);
    expect(get().nodes['sec-1']?.parentId).toBeNull();
    expect(get().nodes['box-1']?.parentId).toBe('sec-1');
  });

  it('rejects moving a node under a parent that cannot contain its type', () => {
    get().addNode(section('sec-1'), null);
    get().addNode(section('sec-2'), null);
    get().addNode(box('box-1'), 'sec-1');
    get().addNode({ id: 'cont-1', type: 'container', parentId: 'sec-2', children: [], styles: {}, hidden: {}, locked: false } as any, 'sec-2');
    expect(() => get().moveNode('box-1', 'sec-2')).not.toThrow();
    expect(() => get().moveNode('sec-1', 'cont-1')).toThrow(ContainmentError);
    expect(get().nodes['sec-1']?.parentId).toBeNull();
  });
});

describe('clipboard — copy / cut / paste / duplicate', () => {
  // Pages live at the root and are added via addPage, not addNode — containment
  // only allows section/nav/footer/componentInstance directly at the root. So
  // build the test tree with a section at the root instead.
  function setupTree() {
    get().addNode(section('sec-1'), null);
    get().addNode(box('box-1'), 'sec-1');
    // box's containment rule is NONE, so addNode rejects heading under box.
    // Paste/duplicate legally create such box→heading nests (they only
    // containment-check the root node, not descendants), so plant h-1 directly.
    const h1 = heading('h-1', 'box-1');
    useEditorStore.setState((s) => ({
      nodes: {
        ...s.nodes,
        [h1.id]: h1,
        'box-1': { ...s.nodes['box-1']!, children: [...s.nodes['box-1']!.children, h1.id] },
      },
    }));
  }

  it('copy snapshots the top-level selection into the clipboard', () => {
    setupTree();
    get().setSelection(['box-1']);
    get().copy(['box-1']);

    const clip = get().clipboard;
    expect(clip).not.toBeNull();
    expect(clip!.roots).toEqual(['box-1']);
    expect(clip!.nodes).toHaveProperty('box-1');
    // descendants are copied too, keyed by their original ids
    expect(clip!.nodes).toHaveProperty('h-1');
    expect(clip!.nodes['h-1']?.parentId).toBe('box-1');
  });

  it('copy only keeps top-level ids (a subtree is not repeated per child)', () => {
    setupTree();
    get().setSelection(['box-1', 'h-1']);
    get().copy(['box-1', 'h-1']);

    const clip = get().clipboard!;
    expect(clip.roots).toEqual(['box-1']);
    // h-1 is a descendant of box-1, so it is not a separate root
    expect(clip.roots).not.toContain('h-1');
    expect(clip.nodes).toHaveProperty('h-1');
  });

  it('paste creates new nodes with new ids under the target parent', () => {
    setupTree();
    get().copy(['box-1']);
    const before = Object.keys(get().nodes);
    get().paste('sec-1');

    const after = Object.keys(get().nodes);
    expect(after).toHaveLength(before.length + 2); // box + heading
    expect(get().nodes['box-1']).toBeDefined(); // original untouched
    const copies = after.filter((id) => !before.includes(id));
    expect(copies).toHaveLength(2);
    const newBox = copies.find((id) => get().nodes[id]!.type === 'box')!;
    const newHeading = copies.find((id) => get().nodes[id]!.type === 'heading')!;
    expect(get().nodes[newBox]!.parentId).toBe('sec-1');
    expect(get().nodes[newHeading]!.parentId).toBe(newBox);
    // the copy is appended to the parent's children
    expect(get().nodes['sec-1']!.children).toContain(newBox);
  });

  it('paste with an empty clipboard does nothing', () => {
    setupTree();
    const before = Object.keys(get().nodes);
    get().paste('sec-1');
    expect(Object.keys(get().nodes)).toEqual(before);
  });

  it('paste rejects a type the target cannot contain (store untouched)', () => {
    setupTree();
    get().copy(['box-1']);
    // a box may not be pasted at the page root
    expect(() => get().paste(null)).toThrow(ContainmentError);
    // and may not be pasted into another box
    expect(() => get().paste('box-1')).toThrow(ContainmentError);
    expect(Object.keys(get().nodes)).toEqual(['sec-1', 'box-1', 'h-1']);
  });

  it('cut copies then removes the selection', () => {
    setupTree();
    get().setSelection(['box-1']);
    get().cut(['box-1']);

    const clip = get().clipboard!;
    expect(clip.roots).toEqual(['box-1']);
    expect(get().nodes).not.toHaveProperty('box-1');
    expect(get().nodes).not.toHaveProperty('h-1');
    expect(get().nodes['sec-1']!.children).toEqual([]);
  });

  it('duplicate inserts a copy immediately after the original in its parent', () => {
    setupTree();
    get().duplicate(['box-1']);

    const sec = get().nodes['sec-1']!;
    expect(sec.children).toHaveLength(2);
    expect(sec.children[0]).toBe('box-1');
    const copyId = sec.children[1]!;
    expect(copyId).not.toBe('box-1');
    expect(get().nodes[copyId]!.type).toBe('box');
    expect(get().nodes[copyId]!.parentId).toBe('sec-1');
    // the heading descendant is duplicated too
    const copyHeading = get().nodes[copyId]!.children[0]!;
    expect(get().nodes[copyHeading]!.type).toBe('heading');
  });

  it('duplicate rejects an illegal root node (store untouched)', () => {
    setupTree();
    // Seed a box at the page root bypassing addNode's containment check, so
    // duplicate's assertCanContain('root', 'box') is the thing being tested.
    useEditorStore.setState({
      nodes: { ...get().nodes, 'root-box': box('root-box') },
    });
    const before = Object.keys(get().nodes);
    expect(() => get().duplicate(['root-box'])).toThrow(ContainmentError);
    expect(Object.keys(get().nodes)).toEqual(before);
  });

  it('removeNodes deletes top-level nodes and all descendants', () => {
    setupTree();
    get().removeNodes(['sec-1']);

    expect(get().nodes).not.toHaveProperty('sec-1');
    expect(get().nodes).not.toHaveProperty('box-1');
    expect(get().nodes).not.toHaveProperty('h-1');
    expect(Object.keys(get().nodes)).toEqual([]);
  });

  it('removeNodes ignores descendants passed directly (top-level only)', () => {
    setupTree();
    get().removeNodes(['box-1', 'h-1']);

    expect(get().nodes).not.toHaveProperty('box-1');
    expect(get().nodes).not.toHaveProperty('h-1');
    expect(get().nodes['sec-1']!.children).toEqual([]);
  });

  it('each clipboard/edit action is one undoable history step', () => {
    setupTree();
    // Reset history so the paste is the first tracked step.
    useEditorStore.setState({ history: [], historyIndex: -1 });

    get().copy(['box-1']);
    expect(get().canUndo()).toBe(false); // copy is UI state, not history
    expect(get().clipboard).not.toBeNull();

    get().paste('sec-1');
    expect(get().canUndo()).toBe(true);
    const indexAfterPaste = get().historyIndex;

    get().undo();
    // undoing the paste removes the copied nodes
    expect(get().nodes).toHaveProperty('box-1');
    const sec = get().nodes['sec-1']!;
    expect(sec.children).toEqual(['box-1']);
    expect(get().historyIndex).toBe(indexAfterPaste - 1);

    get().redo();
    expect(Object.keys(get().nodes)).toHaveLength(5);
    expect(get().historyIndex).toBe(indexAfterPaste);
  });
});

describe('addBlankPage', () => {
  it('adds one page and one root page node with matching ids, slugged from the title, and makes it current', () => {
    const id = get().addBlankPage('Contact');
    const state = get();

    expect(state.pages).toHaveLength(1);
    expect(state.pages[0]!).toMatchObject({
      id,
      title: 'Contact',
      slug: 'contact',
      rootId: id,
      useGlobalHeader: true,
      useGlobalFooter: true,
    });
    expect(state.currentPageId).toBe(id);

    const node = state.nodes[id] as PageNode | undefined;
    expect(node?.type).toBe('page');
    expect(node?.parentId).toBeNull();
    expect(node?.children).toEqual([]);
    expect(node?.title).toBe('Contact');
    expect(node?.slug).toBe('contact');
    expect(node?.backgroundLayers).toEqual([]);
  });

  it('gives repeated titles unique slugs (about, about-2)', () => {
    const first = get().addBlankPage('About');
    expect(get().pages[0]!.slug).toBe('about');

    const second = get().addBlankPage('About');
    expect(get().pages[1]!.slug).toBe('about-2');
    expect(get().pages).toHaveLength(2);
    expect(second).not.toBe(first);
    expect(get().nodes).toHaveProperty(first);
    expect(get().nodes).toHaveProperty(second);
  });

  it('is a single undo step: one undo removes both the page and its node', () => {
    const id = get().addBlankPage('Contact');
    expect(get().canUndo()).toBe(true);
    expect(get().pages).toHaveLength(1);
    expect(get().nodes).toHaveProperty(id);
    expect(get().currentPageId).toBe(id);

    get().undo();

    expect(get().pages).toHaveLength(0);
    expect(get().nodes).not.toHaveProperty(id);
    expect(get().currentPageId).toBeNull();
    expect(get().canUndo()).toBe(false);
    expect(get().canRedo()).toBe(true);

    get().redo();
    expect(get().pages).toHaveLength(1);
    expect(get().pages[0]!.id).toBe(id);
    expect(get().nodes).toHaveProperty(id);
    expect(get().currentPageId).toBe(id);
  });
});
