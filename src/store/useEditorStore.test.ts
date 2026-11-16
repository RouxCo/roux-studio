// src/store/useEditorStore.test.ts
// Editor store tests: undo/redo, the 200-step cap, beginBatch/endBatch
// coalescing, and UI-state-not-tracked (spec §6.4).
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { useEditorStore } from './useEditorStore';
import type { BoxNode, NodeId } from '../types';
import { emptyEditorData } from '../types';

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
    get().addNode(box('n-1'), null);
    expect(get().nodes).toHaveProperty('n-1');
    expect(get().nodes['n-1']?.locked).toBe(false);
    expect(get().canUndo()).toBe(true);

    get().patchNode('n-1', (draft) => {
      draft.locked = true;
    });
    expect(get().nodes['n-1']?.locked).toBe(true);
    expect(get().historyIndex).toBe(1);

    get().undo();
    expect(get().nodes['n-1']?.locked).toBe(false);
    expect(get().historyIndex).toBe(0);

    get().undo();
    expect(get().nodes).not.toHaveProperty('n-1');
    expect(get().historyIndex).toBe(-1);
    expect(get().canUndo()).toBe(false);

    get().redo();
    expect(get().nodes).toHaveProperty('n-1');
    expect(get().nodes['n-1']?.locked).toBe(false);
    expect(get().historyIndex).toBe(0);

    get().redo();
    expect(get().nodes['n-1']?.locked).toBe(true);
    expect(get().historyIndex).toBe(1);
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
