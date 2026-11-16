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
  type Patch,
  type Draft,
} from 'immer';
import type {
  Node, NodeId, PageId, Page, DesignTokens, Breakpoint,
} from '../types';
import { projectBroadcast } from '../db/broadcast';

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
  addPage: (page: Page) => void;
  removePage: (pageId: PageId) => void;
  renamePage: (pageId: PageId, title: string) => void;
  addNode: (node: Node, parentId: NodeId | null) => void;
  removeNode: (nodeId: NodeId) => void;
  moveNode: (nodeId: NodeId, parentId: NodeId | null, index?: number) => void;
  patchNode: (nodeId: NodeId, recipe: (node: Draft<Node>) => void) => void;
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
    const prev = applyPatches(projectDataOf(state), entry.inversePatches);
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
      draft.nodes[node.id] = node;
      const nodeDraft = draft.nodes[node.id];
      if (parentId !== null && nodeDraft) {
        nodeDraft.parentId = parentId;
        const parent = draft.nodes[parentId];
        if (parent) parent.children.push(node.id);
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
