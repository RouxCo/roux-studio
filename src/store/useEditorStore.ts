// src/store/useEditorStore.ts
// Roux Studio editor store — Zustand + Immer patch-based undo/redo.
//
// History tracks project data (nodes, pages, tokens). UI state (breakpoint,
// selection, zoom) is NOT history-tracked. One user intent = one step;
// continuous interactions coalesce between beginBatch/endBatch (spec §6.4).

import { create } from 'zustand';
import {
  produceWithPatches,
  applyPatches,
  enablePatches,
  type Patch,
  type Draft,
} from 'immer';

enablePatches();
import { nanoid } from 'nanoid';
import type {
  Node, NodeId, PageId, Page, DesignTokens, Breakpoint,
  DesignToken, Length, ResponsiveStyles,
} from '../types';
import { projectBroadcast } from '../db/broadcast';
import {
  assertCanContain,
  assertCanMove,
  ContainmentError,
} from './containment';

const HISTORY_CAP = 200;

interface HistoryEntry {
  patches: Patch[];
  inversePatches: Patch[];
}

interface ProjectData {
  projectId: string | null;
  projectName: string;
  pages: Page[];
  tokens: DesignTokens;
  nodes: Record<NodeId, Node>;
  currentPageId: PageId | null;
}

export interface EditorStore extends ProjectData {
  // UI-only state (not persisted to history)
  breakpoint: Breakpoint;
  selection: NodeId[];
  zoom: number;

  // In-memory clipboard: a forest of copied nodes keyed by their (original) ids,
  // plus the root ids of the copied selection. Not history-tracked.
  clipboard: { nodes: Record<NodeId, Node>; roots: NodeId[] } | null;

  // Multi-tab guard: true when another tab saved a newer revision.
  readOnly: boolean;
  remoteRevision: number;
  takeOver: () => void;

  // Undo/redo
  history: HistoryEntry[];
  historyIndex: number;
  isBatching: boolean;
  pendingForward: Patch[];
  pendingInverse: Patch[];

  // ---- actions ----
  setBreakpoint: (bp: Breakpoint) => void;
  setSelection: (ids: NodeId[]) => void;
  setZoom: (z: number) => void;
  beginBatch: () => void;
  endBatch: () => void;

  // Patch-based change to project data. History-tracked unless inside a batch.
  updateData: (recipe: (draft: Draft<ProjectData>) => void) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  reset: (data: ProjectData) => void;

  // Convenience mutations (each is one history step unless batched)
  setCurrentPageId: (id: PageId | null) => void;
  setProjectName: (name: string) => void;
  setTokens: (tokens: DesignTokens) => void;
  addToken: (token: DesignToken) => void;
  updateToken: (name: string, value: string) => void;
  renameToken: (oldName: string, newName: string) => void;
  deleteToken: (name: string, strategy: { replaceWith: string } | 'detach') => void;
  addPage: (page: Page) => void;
  removePage: (pageId: PageId) => void;
  renamePage: (pageId: PageId, title: string) => void;
  addNode: (node: Node, parentId: NodeId | null) => void;
  removeNode: (nodeId: NodeId) => void;
  moveNode: (nodeId: NodeId, parentId: NodeId | null, index?: number) => void;
  patchNode: (nodeId: NodeId, recipe: (node: Draft<Node>) => void) => void;

  // Clipboard / editing actions (each one history step unless batched)
  removeNodes: (ids: NodeId[]) => void;
  copy: (ids: NodeId[]) => void;
  cut: (ids: NodeId[]) => void;
  paste: (targetParentId: NodeId | null) => void;
  duplicate: (ids: NodeId[]) => void;
}

function projectDataOf(state: EditorStore): ProjectData {
  return {
    projectId: state.projectId,
    projectName: state.projectName,
    pages: state.pages,
    tokens: state.tokens,
    nodes: state.nodes,
    currentPageId: state.currentPageId,
  };
}

export const useEditorStore = create<EditorStore>((set, get) => {
  const store: EditorStore = {
  projectId: null,
  projectName: 'Untitled',
  pages: [],
  tokens: { byName: {} },
  nodes: {},
  currentPageId: null,

  breakpoint: 'desktop',
  selection: [],
  zoom: 1,
  clipboard: null,
  readOnly: false,
  remoteRevision: 0,

  history: [],
  historyIndex: -1,
  isBatching: false,
  pendingForward: [],
  pendingInverse: [],

  setBreakpoint: (bp) => set({ breakpoint: bp }),

  setSelection: (ids) => set({ selection: ids }),

  setZoom: (z) => set({ zoom: z }),

  takeOver: () => {
    const { projectId } = get();
    if (!projectId) return;
    const rev = projectBroadcast.announce(projectId).revision;
    set({ readOnly: false, remoteRevision: rev });
  },

  beginBatch: () => set({ isBatching: true }),

  endBatch: () => {
    const state = get();
    set({ isBatching: false });
    if (state.pendingForward.length > 0 || state.pendingInverse.length > 0) {
      pushHistory(get, set, state.pendingForward, state.pendingInverse);
      set({ pendingForward: [], pendingInverse: [] });
    }
  },

  updateData: (recipe) => {
    const state = get();
    const [nextData, patches, inversePatches] = produceWithPatches(
      projectDataOf(state),
      recipe,
    );
    set(nextData);

    if (state.isBatching) {
      set((s) => ({
        pendingForward: [...s.pendingForward, ...patches],
        pendingInverse: [...s.pendingInverse, ...inversePatches],
      }));
    } else {
      pushHistory(get, set, patches, inversePatches);
    }
  },

  undo: () => {
    const state = get();
    if (state.historyIndex < 0) return;
    const entry = state.history[state.historyIndex];
    if (!entry) return;
    // Inverse patches accumulate in chronological order; undo applies them
    // in reverse so the earliest change of a coalesced batch is undone last.
    const prev = applyPatches(
      projectDataOf(state),
      [...entry.inversePatches].reverse(),
    );
    set({ ...prev, historyIndex: state.historyIndex - 1 });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex + 1 >= state.history.length) return;
    const nextIndex = state.historyIndex + 1;
    const entry = state.history[nextIndex];
    if (!entry) return;
    const next = applyPatches(projectDataOf(state), entry.patches);
    set({ ...next, historyIndex: nextIndex });
  },

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex + 1 < get().history.length,

  reset: (data) => {
    set({ ...data, history: [], historyIndex: -1 });
  },

  setCurrentPageId: (id) => {
    get().updateData((draft) => {
      draft.currentPageId = id;
    });
  },

  setProjectName: (name) => {
    get().updateData((draft) => {
      draft.projectName = name;
    });
  },

  setTokens: (tokens) => {
    get().updateData((draft) => {
      draft.tokens = tokens;
    });
  },

  addToken: (token) => {
    get().updateData((draft) => {
      draft.tokens.byName[token.name] = token;
    });
  },

  updateToken: (name, value) => {
    get().updateData((draft) => {
      const token = draft.tokens.byName[name];
      if (token) token.value = value;
    });
  },

  renameToken: (oldName, newName) => {
    get().updateData((draft) => {
      const token = draft.tokens.byName[oldName];
      if (!token || oldName === newName) return;
      // Do nothing if the new name already exists.
      if (draft.tokens.byName[newName]) return;

      token.name = newName;
      draft.tokens.byName[newName] = token;
      delete draft.tokens.byName[oldName];

      const oldColour = `var(--${oldName})`;
      const newColour = `var(--${newName})`;
      const map = (val: unknown): unknown => {
        if (isLengthTokenRef(val, oldName)) return { ...val, token: newName };
        if (val === oldColour) return newColour;
        return val;
      };
      for (const node of Object.values(draft.nodes)) {
        rewriteTokenRefs(node.styles, map);
      }
      for (const other of Object.values(draft.tokens.byName)) {
        if (other.name === newName) continue;
        other.value = rewriteTokenValue(other.value, map);
      }
    });
  },

  deleteToken: (name, strategy) => {
    get().updateData((draft) => {
      const token = draft.tokens.byName[name];
      if (!token) return;

      const replaceWith =
        typeof strategy === 'object' ? strategy.replaceWith : null;
      const oldColour = `var(--${name})`;
      const map = (val: unknown): unknown => {
        if (isLengthTokenRef(val, name)) {
          if (replaceWith) return { ...val, token: replaceWith };
          return { kind: 'px', value: parseFloat(token.value) || 0 };
        }
        if (typeof val === 'string' && val === oldColour) {
          if (replaceWith) return `var(--${replaceWith})`;
          return token.value;
        }
        return val;
      };
      for (const node of Object.values(draft.nodes)) {
        rewriteTokenRefs(node.styles, map);
      }
      for (const other of Object.values(draft.tokens.byName)) {
        if (other.name === name) continue;
        other.value = rewriteTokenValue(other.value, map);
      }
      delete draft.tokens.byName[name];
    });
  },

  addPage: (page) => {
    get().updateData((draft) => {
      draft.pages.push(page);
    });
  },

  removePage: (pageId) => {
    get().updateData((draft) => {
      draft.pages = draft.pages.filter((p) => p.id !== pageId);
      if (draft.currentPageId === pageId) {
        draft.currentPageId =
          draft.pages.length > 0 ? draft.pages[0]!.id : null;
      }
    });
  },

  renamePage: (pageId, title) => {
    get().updateData((draft) => {
      const page = draft.pages.find((p) => p.id === pageId);
      if (page) page.title = title;
    });
  },

  addNode: (node, parentId) => {
    get().updateData((draft) => {
      const parent = parentId === null ? null : draft.nodes[parentId];
      const parentType = parent === null ? 'root' : parent?.type;
      if (parentType === undefined) {
        throw new ContainmentError(
          `Cannot add ${node.id} (${node.type}): parent "${parentId}" does not exist.`,
        );
      }
      assertCanContain(parentType, node.type);
      draft.nodes[node.id] = node;
      const nodeDraft = draft.nodes[node.id];
      if (parentId !== null && nodeDraft) {
        nodeDraft.parentId = parentId;
        const p = draft.nodes[parentId];
        if (p) p.children.push(node.id);
      } else if (nodeDraft) {
        nodeDraft.parentId = null;
      }
    });
  },

  removeNode: (nodeId) => {
    get().updateData((draft) => {
      const descendants = collectDescendants(draft.nodes, nodeId);
      for (const id of descendants) {
        delete draft.nodes[id];
      }
      const node = draft.nodes[nodeId];
      if (node && node.parentId !== null) {
        const parent = draft.nodes[node.parentId];
        if (parent) {
          parent.children = parent.children.filter((id) => id !== nodeId);
        }
      }
      delete draft.nodes[nodeId];
    });
  },

  moveNode: (nodeId, parentId, index) => {
    get().updateData((draft) => {
      assertCanMove(draft.nodes, nodeId, parentId);
      const node = draft.nodes[nodeId];
      if (!node) return;

      if (node.parentId !== null) {
        const oldParent = draft.nodes[node.parentId];
        if (oldParent) {
          oldParent.children = oldParent.children.filter((id) => id !== nodeId);
        }
      }

      node.parentId = parentId;

      if (parentId !== null) {
        const parent = draft.nodes[parentId];
        if (parent) {
          const children = parent.children;
          const at =
            index === undefined
              ? children.length
              : Math.max(0, Math.min(index, children.length));
          children.splice(at, 0, nodeId);
        }
      }
    });
  },

  patchNode: (nodeId, recipe) => {
    get().updateData((draft) => {
      const node = draft.nodes[nodeId];
      if (!node) return;
      recipe(node);
    });
  },

  removeNodes: (ids) => {
    const top = filterTopLevel(get().nodes, ids);
    get().updateData((draft) => {
      const toRemove = new Set<NodeId>();
      for (const id of top) {
        toRemove.add(id);
        for (const descId of collectDescendants(draft.nodes, id)) {
          toRemove.add(descId);
        }
      }
      for (const id of toRemove) {
        const node = draft.nodes[id];
        if (!node) continue;
        if (node.parentId !== null) {
          const parent = draft.nodes[node.parentId];
          if (parent) {
            parent.children = parent.children.filter((cid) => cid !== id);
          }
        }
        delete draft.nodes[id];
      }
    });
  },

  copy: (ids) => {
    const state = get();
    const top = filterTopLevel(state.nodes, ids);
    const nodes: Record<NodeId, Node> = {};
    const roots: NodeId[] = [];
    for (const id of top) {
      if (!state.nodes[id]) continue;
      Object.assign(nodes, cloneSubtree(state.nodes, id));
      roots.push(id);
    }
    set({ clipboard: { nodes, roots } });
  },

  cut: (ids) => {
    get().copy(ids);
    get().removeNodes(ids);
  },

  paste: (targetParentId) => {
    const state = get();
    const clip = state.clipboard;
    if (!clip || clip.roots.length === 0) return;
    const rootsSet = new Set(clip.roots);
    get().updateData((draft) => {
      const parentType =
        targetParentId === null ? 'root' : draft.nodes[targetParentId]?.type;
      if (targetParentId !== null && !parentType) {
        throw new ContainmentError(`Paste target ${targetParentId} does not exist.`);
      }
      for (const rootId of clip.roots) {
        const rootNode = clip.nodes[rootId];
        if (!rootNode) continue;
        assertCanContain(parentType ?? 'root', rootNode.type);
      }
      const idMap = new Map<NodeId, NodeId>();
      for (const oldId of Object.keys(clip.nodes)) idMap.set(oldId, nanoid());
      for (const oldId of Object.keys(clip.nodes)) {
        const source = clip.nodes[oldId];
        if (!source) continue;
        const newId = idMap.get(oldId)!;
        const node: Node = { ...source };
        node.id = newId;
        node.parentId = rootsSet.has(oldId)
          ? targetParentId
          : (source.parentId === null ? null : idMap.get(source.parentId)!);
        node.children = source.children.map((c) => idMap.get(c)!);
        draft.nodes[newId] = node;
      }
      if (targetParentId !== null) {
        const parent = draft.nodes[targetParentId];
        if (parent) {
          parent.children.push(...clip.roots.map((id) => idMap.get(id)!));
        }
      }
    });
  },

  duplicate: (ids) => {
    const state = get();
    const top = filterTopLevel(state.nodes, ids);
    const nodes = state.nodes; // plain (non-draft) nodes so cloneSubtree's structuredClone works
    get().updateData((draft) => {
      for (const id of top) {
        const node = nodes[id];
        if (!node) continue;
        const parentId = node.parentId;
        const parent = parentId === null ? null : draft.nodes[parentId];
        const parentType = parent ? parent.type : 'root';
        assertCanContain(parentType, node.type);
        const sub = cloneSubtree(nodes, id);
        const idMap = new Map<NodeId, NodeId>();
        for (const oldId of Object.keys(sub)) idMap.set(oldId, nanoid());
        const newRootId = idMap.get(id)!;
        for (const oldId of Object.keys(sub)) {
          const source = sub[oldId];
          if (!source) continue;
          const newId = idMap.get(oldId)!;
          const n: Node = { ...source };
          n.id = newId;
          n.parentId = oldId === id ? parentId : (source.parentId === null ? null : idMap.get(source.parentId)!);
          n.children = source.children.map((c) => idMap.get(c)!);
          draft.nodes[newId] = n;
        }
        if (parent) {
          const idx = parent.children.indexOf(id);
          parent.children.splice(idx >= 0 ? idx + 1 : parent.children.length, 0, newRootId);
        }
      }
    });
  },
};
  projectBroadcast.subscribe((notice) => {
    const state = get();
    if (!state.projectId || notice.projectId !== state.projectId) return;
    if (notice.revision > state.remoteRevision) {
      set({ readOnly: true, remoteRevision: notice.revision });
    }
  });
  return store;
});

function pushHistory(
  get: () => EditorStore,
  set: (partial: Partial<EditorStore>) => void,
  patches: Patch[],
  inversePatches: Patch[],
) {
  const state = get();
  let next = state.history.slice(0, state.historyIndex + 1);
  next.push({ patches, inversePatches });
  if (next.length > HISTORY_CAP) next = next.slice(1);
  set({
    history: next,
    historyIndex: next.length - 1,
  });
}

function collectDescendants(
  nodes: Record<NodeId, Node>,
  nodeId: NodeId,
): NodeId[] {
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

// Deep-clone a node and all of its descendants, keyed by their original ids.
function cloneSubtree(nodes: Record<NodeId, Node>, rootId: NodeId): Record<NodeId, Node> {
  const out: Record<NodeId, Node> = {};
  const stack: NodeId[] = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = nodes[id];
    if (!node || out[id]) continue;
    out[id] = structuredClone(node);
    for (const childId of node.children) stack.push(childId);
  }
  return out;
}

// Keep only the selected ids that are not descendants of another selected id,
// so copying/deleting/duplicating a subtree isn't repeated for its children.
function filterTopLevel(nodes: Record<NodeId, Node>, ids: NodeId[]): NodeId[] {
  const out: NodeId[] = [];
  for (const id of ids) {
    const isDescendant = ids.some(
      (other) => other !== id && collectDescendants(nodes, other).includes(id),
    );
    if (!isDescendant) out.push(id);
  }
  return out;
}

function isLengthTokenRef(val: unknown, name: string): val is Draft<Length> {
  return (
    typeof val === 'object' &&
    val !== null &&
    (val as Length).kind === 'token' &&
    (val as Length).token === name
  );
}

// Map every style value across all breakpoints of a node's responsive styles,
// replacing values for which `map` returns something different from the input.
function rewriteTokenRefs(
  styles: Draft<ResponsiveStyles>,
  map: (val: unknown) => unknown,
): void {
  for (const key of Object.keys(styles) as Array<keyof ResponsiveStyles>) {
    const responsive = styles[key];
    if (!responsive) continue;
    for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
      const val = responsive[bp];
      if (val === undefined) continue;
      const next = map(val);
      if (next !== val) {
        (responsive as Record<Breakpoint, unknown>)[bp] = next;
      }
    }
  }
}

// Apply `map` to a single token value string, rewriting any `var(--oldName)`
// occurrence it contains. Returns the (possibly unchanged) string.
function rewriteTokenValue(value: string, map: (val: unknown) => unknown): string {
  return value.replace(/var\(--([^)]+)\)/g, (_, varName) => {
    const next = map(`var(--${varName})`);
    return typeof next === 'string' ? next : `var(--${varName})`;
  });
}

// Count how many nodes reference the token, in any style property at any
// breakpoint. A node counts once even if it references the token multiple times.
export function tokenUsage(nodes: Record<NodeId, Node>, name: string): number {
  const colour = `var(--${name})`;
  let count = 0;
  for (const node of Object.values(nodes)) {
    let used = false;
    for (const key of Object.keys(node.styles) as Array<keyof ResponsiveStyles>) {
      const responsive = node.styles[key];
      if (!responsive) continue;
      for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
        const val = responsive[bp];
        if (val === undefined) continue;
        if (isLengthTokenRef(val, name) || (typeof val === 'string' && val === colour)) {
          used = true;
          break;
        }
      }
      if (used) break;
    }
    if (used) count++;
  }
  return count;
}
