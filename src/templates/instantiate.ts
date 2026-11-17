// src/templates/instantiate.ts
// Roux Studio — template instantiation (M4 Job 7).
//
// Deep-clones a stored project into a fresh project: new project id, new node
// ids (nanoid), every children array / parentId / Page.id / Page.rootId /
// globalHeaderId / globalFooterId / block id remapped through one old→new map.
// Token names are left untouched (they are referenced by name). Throws an Error
// naming any missing id rather than emitting a dangling reference.

import type { Node, NodeId } from '../types';
import type { StoredProject } from '../db/stores';
import { nanoid } from 'nanoid';

const now = () => new Date().toISOString();

export function instantiateProject(source: StoredProject, name: string): StoredProject {
  const clone = structuredClone(source);

  // One old→new id map covering every node id (top-level and inside blocks).
  const idMap = new Map<NodeId, NodeId>();
  for (const oldId of Object.keys(clone.nodes)) {
    idMap.set(oldId, nanoid());
  }
  for (const block of clone.blocks) {
    for (const oldId of Object.keys(block.nodes)) {
      idMap.set(oldId, nanoid());
    }
  }

  const remap = (id: NodeId | null): NodeId | null => {
    if (id === null) return null;
    const next = idMap.get(id);
    if (!next) throw new Error(`Missing node id: ${id}`);
    return next;
  };
  const remapId = (id: NodeId): NodeId => {
    const next = idMap.get(id);
    if (!next) throw new Error(`Missing node id: ${id}`);
    return next;
  };

  // Remap top-level nodes.
  const newNodes: Record<NodeId, Node> = {};
  for (const [oldId, node] of Object.entries(clone.nodes)) {
    const newId = idMap.get(oldId) as NodeId;
    const newNode: Node = { ...node, id: newId };
    newNode.children = node.children.map(remapId);
    newNode.parentId = remap(node.parentId);
    newNodes[newId] = newNode;
  }
  clone.nodes = newNodes;

  // Remap pages.
  for (const page of clone.pages) {
    page.id = remapId(page.id);
    page.rootId = remapId(page.rootId);
  }

  // Remap globals.
  clone.globalHeaderId = remap(clone.globalHeaderId);
  clone.globalFooterId = remap(clone.globalFooterId);

  // Remap blocks (new block id, new root, remapped inner nodes).
  for (const block of clone.blocks) {
    block.id = nanoid();
    block.rootId = remapId(block.rootId);
    const newBlockNodes: Record<NodeId, Node> = {};
    for (const [oldId, node] of Object.entries(block.nodes)) {
      const newId = idMap.get(oldId) as NodeId;
      const newNode: Node = { ...node, id: newId };
      newNode.children = node.children.map(remapId);
      newNode.parentId = remap(node.parentId);
      newBlockNodes[newId] = newNode;
    }
    block.nodes = newBlockNodes;
  }

  clone.id = nanoid();
  clone.name = name;
  clone.createdAt = now();
  clone.updatedAt = now();

  return clone;
}
