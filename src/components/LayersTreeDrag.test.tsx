// src/components/LayersTreeDrag.test.tsx
// Job 5 — Drag and drop in the layers tree (handleDragEnd).
//
// Covers: sibling reorder, moving into a different parent, illegal moves that
// leave the store untouched, and dragging a page (which does nothing).
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import type { DragEndEvent } from '@dnd-kit/core';
import { handleDragEnd } from './LayersTree';
import { emptyEditorData } from '../types';
import type { Node, NodeId } from '../types';

function secNode(id: NodeId, parentId: NodeId | null, children: NodeId[] = []): Node {
  return {
    id, type: 'section', parentId, children,
    styles: {}, hidden: {}, locked: false,
    backgroundLayers: [], sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  } as Node;
}

function boxNode(id: NodeId, parentId: NodeId | null, children: NodeId[] = []): Node {
  return {
    id, type: 'box', parentId, children, styles: {}, hidden: {}, locked: false,
  } as Node;
}

function pageNode(children: NodeId[] = []): Node {
  return {
    id: 'page-1', type: 'page', parentId: null, children,
    styles: {}, hidden: {}, locked: false, title: 'Home', slug: 'home', backgroundLayers: [],
  } as Node;
}

function dragEvent(draggedId: NodeId, targetId: NodeId | null): DragEndEvent {
  return {
    active: { id: draggedId } as any,
    over: targetId ? ({ id: targetId } as any) : null,
  } as DragEndEvent;
}

function setup(nodes: Record<NodeId, Node>, currentPageId = 'page-1') {
  useEditorStore.setState({
    ...emptyEditorData(),
    pages: [{ id: 'page-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
    nodes,
    currentPageId,
    selection: [],
    history: [],
    historyIndex: -1,
  });
  return { get: () => useEditorStore.getState() };
}

afterEach(() => {
  useEditorStore.setState({ ...emptyEditorData(), selection: [], clipboard: null });
});

describe('LayersTree drag and drop', () => {
  it('reorders siblings and records one history step', () => {
    const { get } = setup({
      'page-1': pageNode(['sec-1', 'sec-2']),
      'sec-1': secNode('sec-1', 'page-1'),
      'sec-2': secNode('sec-2', 'page-1'),
    });

    act(() => {
      handleDragEnd(get().nodes, get().moveNode, dragEvent('sec-2', 'sec-1'));
    });

    const state = get();
    expect(state.nodes['page-1']!.children).toEqual(['sec-2', 'sec-1']);
    expect(state.historyIndex).toBe(0);
    expect(state.history).toHaveLength(1);
  });

  it('moves a node into a different parent and records one history step', () => {
    const { get } = setup({
      'page-1': pageNode(['sec-1', 'sec-2']),
      'sec-1': secNode('sec-1', null, ['box-1']),
      'sec-2': secNode('sec-2', null),
      'box-1': boxNode('box-1', 'sec-1'),
    });

    act(() => {
      handleDragEnd(get().nodes, get().moveNode, dragEvent('box-1', 'sec-2'));
    });

    const state = get();
    expect(state.nodes['box-1']!.parentId).toBe('sec-2');
    expect(state.nodes['sec-1']!.children).toEqual([]);
    expect(state.nodes['sec-2']!.children).toContain('box-1');
    expect(state.historyIndex).toBe(0);
    expect(state.history).toHaveLength(1);
  });

  it('leaves the store untouched for an illegal move (section into a box)', () => {
    const { get } = setup({
      'page-1': pageNode(['sec-1', 'box-1']),
      'sec-1': secNode('sec-1', null),
      'box-1': boxNode('box-1', null),
    });
    const before = JSON.stringify(get());

    // box can't contain a section → canContain is false → handleDragEnd returns early.
    act(() => {
      handleDragEnd(get().nodes, get().moveNode, dragEvent('sec-1', 'box-1'));
    });

    expect(JSON.stringify(get())).toBe(before);
    expect(get().historyIndex).toBe(-1);
    expect(get().history).toHaveLength(0);
  });

  it('leaves the store untouched when dragging a page', () => {
    const { get } = setup({
      'page-1': pageNode(['sec-1']),
      'sec-1': secNode('sec-1', null),
    });
    const before = JSON.stringify(get());

    act(() => {
      handleDragEnd(get().nodes, get().moveNode, dragEvent('page-1', 'sec-1'));
    });

    expect(JSON.stringify(get())).toBe(before);
    expect(get().historyIndex).toBe(-1);
  });

  it('does nothing when there is no drop target', () => {
    const { get } = setup({
      'page-1': pageNode(['sec-1']),
      'sec-1': secNode('sec-1', null),
    });
    const before = JSON.stringify(get());

    act(() => {
      handleDragEnd(get().nodes, get().moveNode, dragEvent('sec-1', null));
    });

    expect(JSON.stringify(get())).toBe(before);
    expect(get().historyIndex).toBe(-1);
  });
});
