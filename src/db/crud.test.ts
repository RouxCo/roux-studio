// src/db/crud.test.ts
// Project CRUD tests: bridges IndexedDB (stores.ts) and the Zustand editor store.
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { useEditorStore } from '../store/useEditorStore';
import type { EditorStore } from '../store/useEditorStore';
import {
  createProject,
  loadProject,
  removeProject,
  saveProject,
  listAllProjects,
} from './crud';
import { emptyEditorData } from '../types';

const get = () => useEditorStore.getState();
const set = (partial: Partial<EditorStore>) => useEditorStore.setState(partial);

async function clearProjects() {
  const { getDB } = await import('./stores');
  const db = await getDB();
  await db.clear('projects');
}

async function storedProject(id: string) {
  const { getProject } = await import('./stores');
  return getProject(id);
}

beforeEach(async () => {
  useEditorStore.setState({
    ...emptyEditorData(),
    history: [],
    historyIndex: -1,
  });
  await clearProjects();
});

describe('crud', () => {
  it('createProject persists and loads into the store, returns id', async () => {
    const id = await createProject(set);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const state = get();
    expect(state.projectId).toBe(id);
    expect(state.projectName).toBe('Untitled');
    expect(state.pages).toEqual([]);

    const stored = await storedProject(id);
    expect(stored?.id).toBe(id);
    expect(stored?.name).toBe('Untitled');
    expect(stored?.createdAt).toBeDefined();
    expect(stored?.updatedAt).toBeDefined();
  });

  it('loadProject returns false for a missing project', async () => {
    expect(await loadProject(set, 'nope')).toBe(false);
    expect(get().projectId).toBeNull();
  });

  it('loadProject loads an existing project into the store', async () => {
    const id = await createProject(set);
    set({ projectName: 'Changed' });
    expect(get().projectName).toBe('Changed');

    expect(await loadProject(set, id)).toBe(true);
    expect(get().projectId).toBe(id);
    expect(get().projectName).toBe('Untitled');
  });

  it('saveProject persists current state with refreshed updatedAt', async () => {
    await createProject(set);
    const first = await storedProject(get().projectId!);
    expect(first).toBeDefined();

    set({ projectName: 'Renamed' });
    await saveProject(get);

    const stored = await storedProject(get().projectId!);
    expect(stored?.name).toBe('Renamed');
    expect(stored?.updatedAt).not.toBe(first?.updatedAt);
  });

  it('removeProject deletes and resets the store when current', async () => {
    const id = await createProject(set);
    await removeProject(get, set, id);
    expect(get().projectId).toBeNull();
    expect(get().projectName).toBe('Untitled');
    expect(await storedProject(id)).toBeUndefined();
  });

  it('removeProject does not reset the store when not current', async () => {
    const id1 = await createProject(set);
    await new Promise((r) => setTimeout(r, 15));
    const id2 = await createProject(set);
    expect(get().projectId).toBe(id2);

    await removeProject(get, set, id1);
    expect(get().projectId).toBe(id2);
    expect(await storedProject(id1)).toBeUndefined();
    expect(await storedProject(id2)).toBeDefined();
  });

  it('listAllProjects returns most recently updated first', async () => {
    const id1 = await createProject(set);
    await new Promise((r) => setTimeout(r, 15));
    const id2 = await createProject(set);

    const list = await listAllProjects();
    expect(list.map((p) => p.id)).toEqual([id2, id1]);
    expect(list[0]).toMatchObject({ id: id2, name: 'Untitled' });
  });
});
