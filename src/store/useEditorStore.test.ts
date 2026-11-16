// src/store/useEditorStore.test.ts
// Editor store tests: undo/redo, the 200-step cap, beginBatch/endBatch
// coalescing, and UI-state-not-tracked (spec §6.4).
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { useEditorStore } from './useEditorStore';
import type { BoxNode, NodeId, SectionNode } from '../types';
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
