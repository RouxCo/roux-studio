// src/db/crud.ts
// Project CRUD: bridges IndexedDB (stores.ts) and the Zustand editor store.
//
// Persisted: project id/name, pages, tokens, nodes, createdAt, updatedAt.
// UI-only (never stored): currentPageId, breakpoint, selection.
//
// createdAt is carried over from the existing record when overwriting a
// project; updatedAt is refreshed on every save. Each save also announces
// a revision bump on the BroadcastChannel so other tabs can react.

import type { EditorStore } from '../store/useEditorStore';
import type { ProjectSummary } from './stores';
import {
  deleteProject as dbDeleteProject,
  getProject as dbGetProject,
  listProjects as dbListProjects,
  putProject as dbPutProject,
  type StoredProject,
} from './stores';
import { emptyEditorData } from '../types';
import { nanoid } from 'nanoid';
import { projectBroadcast } from './broadcast';
import { migrateStored, SCHEMA_VERSION } from './migrate';

const now = () => new Date().toISOString();

type StoreGet = () => EditorStore;
type StoreSet = (partial: Partial<EditorStore>) => void;

function editorDataFromStored(p: StoredProject): Partial<EditorStore> {
  return {
    projectId: p.id,
    projectName: p.name,
    pages: p.pages,
    tokens: p.tokens,
    nodes: p.nodes,
    currentPageId: p.pages.length > 0 ? p.pages[0]!.id : null,
    breakpoint: 'desktop',
    selection: [],
    history: [],
    historyIndex: -1,
    blocks: p.blocks,
    globalHeaderId: p.globalHeaderId,
    globalFooterId: p.globalFooterId,
  };
}

async function storedProjectFromStore(get: StoreGet): Promise<StoredProject> {
  const {
    projectId,
    projectName,
    pages,
    tokens,
    nodes,
    blocks,
    globalHeaderId,
    globalFooterId,
  } = get();
  const existing = projectId ? await dbGetProject(projectId) : undefined;
  return {
    id: projectId!,
    name: projectName,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
    pages,
    tokens,
    nodes,
    blocks: blocks ?? [],
    globalHeaderId: globalHeaderId ?? null,
    globalFooterId: globalFooterId ?? null,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** Create a new empty project, persist it, load it into the store, return its id. */
export async function createProject(set: StoreSet): Promise<string> {
  const id = nanoid();
  const stored: StoredProject = {
    id,
    name: 'Untitled',
    createdAt: now(),
    updatedAt: now(),
    pages: [],
    tokens: { byName: {} },
    nodes: {},
    blocks: [],
    globalHeaderId: null,
    globalFooterId: null,
    schemaVersion: SCHEMA_VERSION,
  };
  await dbPutProject(stored);
  set(editorDataFromStored(stored));
  projectBroadcast.announce(id);
  return id;
}

/** Load a project from IndexedDB into the store. Returns false if missing. */
export async function loadProject(set: StoreSet, id: string): Promise<boolean> {
  const stored = await dbGetProject(id);
  if (!stored) return false;
  set(editorDataFromStored(migrateStored(stored)));
  return true;
}

/** Persist the current editor state to IndexedDB and announce a new revision. */
export async function saveProject(get: StoreGet): Promise<void> {
  const { projectId } = get();
  if (!projectId) return;
  const stored = await storedProjectFromStore(get);
  await dbPutProject(stored);
  projectBroadcast.announce(projectId);
}

/** Delete a project from IndexedDB; reset the store if it was the current one. */
export async function removeProject(get: StoreGet, set: StoreSet, id: string): Promise<void> {
  await dbDeleteProject(id);
  if (get().projectId === id) {
    set({
      ...emptyEditorData(),
      history: [],
      historyIndex: -1,
    });
  }
}

/** List all projects, most recently updated first. */
export async function listAllProjects(): Promise<ProjectSummary[]> {
  return dbListProjects();
}

export { type StoredProject };
