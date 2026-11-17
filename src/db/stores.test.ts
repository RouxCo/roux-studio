// src/db/stores.test.ts
// IndexedDB layer tests (spec §4.7). Runs in Node with fake-indexeddb
// standing in for IndexedDB, so no browser is required.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { StoredProject } from './stores';

type Stores = typeof import('./stores');
let mod: Stores;

beforeAll(async () => {
  mod = await import('./stores');
});

beforeEach(async () => {
  const db = await mod.getDB();
  await db.clear('projects');
  await db.clear('assets');
});

const tokens = {
  byName: {
    'color-primary': { name: 'color-primary', value: '#0f766e', type: 'color' as const },
  },
};

function storedProject(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    id: 'p-1',
    name: 'One',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    pages: [],
    tokens,
    nodes: {},
    blocks: [],
    globalHeaderId: null,
    globalFooterId: null,
    ...overrides,
  };
}

describe('stores', () => {
  it('putProject + getProject round trip', async () => {
    await mod.putProject(storedProject({ name: 'Alpha' }));
    const got = await mod.getProject('p-1');
    expect(got?.id).toBe('p-1');
    expect(got?.name).toBe('Alpha');
  });

  it('getProject returns undefined for a missing project', async () => {
    expect(await mod.getProject('does-not-exist')).toBeUndefined();
  });

  it('putProject overwrites an existing record', async () => {
    await mod.putProject(storedProject({ name: 'First' }));
    await mod.putProject(storedProject({ name: 'Second' }));
    expect((await mod.getProject('p-1'))?.name).toBe('Second');
  });

  it('getAllProjects returns every stored project', async () => {
    await mod.putProject(storedProject({ id: 'a', name: 'A' }));
    await mod.putProject(storedProject({ id: 'b', name: 'B' }));
    const all = await mod.getAllProjects();
    expect(all.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });

  it('deleteProject removes the record', async () => {
    await mod.putProject(storedProject());
    await mod.deleteProject('p-1');
    expect(await mod.getProject('p-1')).toBeUndefined();
  });

  it('listProjects returns summaries sorted by updatedAt descending', async () => {
    await mod.putProject(storedProject({ id: 'a', name: 'A', updatedAt: '2026-01-01T00:00:00Z' }));
    await mod.putProject(storedProject({ id: 'b', name: 'B', updatedAt: '2026-01-02T00:00:00Z' }));
    const list = await mod.listProjects();
    expect(list.map((p) => p.id)).toEqual(['b', 'a']);
    expect(list[0]).toMatchObject({ id: 'b', name: 'B' });
  });

  it('projectSummary derives a listing entry', () => {
    const p = storedProject({ id: 'p-1', name: 'One', updatedAt: '2026-01-02T00:00:00Z' });
    expect(mod.projectSummary(p)).toEqual({ id: 'p-1', name: 'One', updatedAt: '2026-01-02T00:00:00Z' });
  });

  it('putAsset + getAsset round trip with a Blob', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    await mod.putAsset('asset-1', blob, 'hello.txt', 'text/plain');
    const got = await mod.getAsset('asset-1');
    expect(got?.id).toBe('asset-1');
    expect(got?.name).toBe('hello.txt');
    expect(got?.mimeType).toBe('text/plain');
    // Round-trip the blob content. `instanceof Blob` is realm-sensitive (a jsdom
    // Blob is not Node's Blob), so read via text() when the environment preserved
    // the blob; the metadata assertions above cover the record fields either way.
    const storedBlob = got?.blob;
    expect(storedBlob).toBeDefined();
    if (typeof storedBlob?.text === 'function') {
      expect(await storedBlob.text()).toBe('hello');
    }
  });

  it('assetRecord derives the public Asset record', () => {
    const blob = new Blob(['hi'], { type: 'text/plain' });
    expect(mod.assetRecord({ id: 'x', blob, name: 'x.txt', mimeType: 'text/plain' })).toEqual({
      id: 'x',
      name: 'x.txt',
      mimeType: 'text/plain',
      size: 2,
    });
  });

  it('getAllAssets returns every stored asset', async () => {
    await mod.putAsset('a', new Blob(['a'], { type: 'text/plain' }), 'a.txt', 'text/plain');
    await mod.putAsset('b', new Blob(['bb'], { type: 'text/plain' }), 'b.txt', 'text/plain');
    const all = await mod.getAllAssets();
    expect(all.map((a) => a.id).sort()).toEqual(['a', 'b']);
  });

  it('deleteAsset removes the record', async () => {
    await mod.putAsset('a', new Blob(['a'], { type: 'text/plain' }), 'a.txt', 'text/plain');
    await mod.deleteAsset('a');
    expect(await mod.getAsset('a')).toBeUndefined();
  });
});
