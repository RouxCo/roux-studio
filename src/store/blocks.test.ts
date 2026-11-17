// src/store/blocks.test.ts
// Block actions: saveAsBlock snapshots a subtree with fresh ids, insertBlock
// copies it fresh on every insert, renameBlock/deleteBlock manage the block list.
import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore } from './useEditorStore';
import type { BoxNode, Node, NodeId, SectionNode } from '../types';
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

function treeIds(nodes: Record<NodeId, Node>, root: NodeId): NodeId[] {
  const out: NodeId[] = [root];
  const stack: NodeId[] = [root];
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

function makeSectionWithChildren() {
  get().addNode(section('sec-1'), null);
  get().addNode(box('child-1'), 'sec-1');
  get().addNode(box('child-2'), 'sec-1');
}

beforeEach(() => {
  useEditorStore.setState({
    ...emptyEditorData(),
    history: [],
    historyIndex: -1,
  });
});

describe('saveAsBlock', () => {
  it('saves a section subtree with all ids remapped and rootId set', () => {
    makeSectionWithChildren();
    const originalRoot = get().nodes['sec-1']!;

    get().saveAsBlock('sec-1', 'Hero');

    const state = get();
    expect(state.blocks).toHaveLength(1);
    const block = state.blocks[0]!;
    expect(block.name).toBe('Hero');
    expect(block.rootId).not.toBe('sec-1');
    expect(block.nodes).not.toHaveProperty('sec-1');
    expect(block.nodes).not.toHaveProperty('child-1');
    expect(block.nodes).not.toHaveProperty('child-2');

    // The block's subtree mirrors the original shape with fresh ids.
    const blockTree = treeIds(block.nodes, block.rootId);
    expect(blockTree).toHaveLength(3);
    expect(block.nodes[block.rootId]!.children).toEqual(
      blockTree.filter((id) => id !== block.rootId),
    );

    // Originals in the store are untouched.
    expect(get().nodes['sec-1']).toBe(originalRoot);
    expect(get().nodes['child-1']).toBeDefined();
  });

  it('is a no-op for non-section/container nodes', () => {
    get().addNode(section('sec-1'), null);
    get().addNode(box('box-1'), 'sec-1');
    get().saveAsBlock('box-1', 'Nope');
    expect(get().blocks).toEqual([]);
  });
});

describe('insertBlock', () => {
  it('inserts two independent copies with all-unique ids', () => {
    makeSectionWithChildren();
    get().saveAsBlock('sec-1', 'Hero');
    const block = get().blocks[0]!;
    const blockIds = Object.keys(block.nodes);

    const stepsBefore = get().history.length;
    get().insertBlock(block.id, null);
    expect(get().history.length).toBe(stepsBefore + 1); // one undo step

    const root1 = get().selection[0]!;
    expect(get().nodes[root1]!.parentId).toBeNull();

    const stepsBefore2 = get().history.length;
    get().insertBlock(block.id, null);
    expect(get().history.length).toBe(stepsBefore2 + 1); // one undo step

    const root2 = get().selection[0]!;
    expect(root2).not.toBe(root1);

    const all = new Set([...treeIds(get().nodes, root1), ...treeIds(get().nodes, root2), ...blockIds]);
    expect(all.size).toBe(
      treeIds(get().nodes, root1).length +
        treeIds(get().nodes, root2).length +
        blockIds.length,
    );
  });

  it('editing one copy leaves the other copy and the block unchanged', () => {
    makeSectionWithChildren();
    get().saveAsBlock('sec-1', 'Hero');
    const block = get().blocks[0]!;
    const blockRootId = block.rootId;
    const blockChildId = block.nodes[blockRootId]!.children[0]!;

    get().insertBlock(block.id, null);
    const root1 = get().selection[0]!;
    const child1 = get().nodes[root1]!.children[0]!;

    get().insertBlock(block.id, null);
    const root2 = get().selection[0]!;
    const child2 = get().nodes[root2]!.children[0]!;

    get().patchNode(child1, (n) => {
      n.locked = true;
    });

    expect(get().nodes[child2]!.locked).toBe(false);
    expect(get().blocks[0]!.nodes[blockChildId]!.locked).toBe(false);
    expect(get().blocks[0]!.nodes[blockRootId]!.locked).toBe(false);
  });

  it('rejects inserting a section under a box with ContainmentError', () => {
    makeSectionWithChildren();
    get().saveAsBlock('sec-1', 'Hero');
    const block = get().blocks[0]!;
    get().addNode(box('box-1'), 'sec-1');

    expect(() => get().insertBlock(block.id, 'box-1')).toThrow(ContainmentError);
  });
});

describe('renameBlock / deleteBlock', () => {
  it('renames and deletes a block', () => {
    makeSectionWithChildren();
    get().saveAsBlock('sec-1', 'Hero');
    const blockId = get().blocks[0]!.id;

    get().renameBlock(blockId, 'Renamed');
    expect(get().blocks[0]!.name).toBe('Renamed');

    get().deleteBlock(blockId);
    expect(get().blocks).toEqual([]);
  });
});
