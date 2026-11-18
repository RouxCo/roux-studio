// src/export/import.test.ts
// Tests for importProjectFromZip: project.json restored into IndexedDB,
// asset blobs extracted into the assets store via putAsset, missing
// project.json rejected. Runs in jsdom with fake-indexeddb standing in for
// IndexedDB.
//
// Note: fake-indexeddb strips Blob instances to {} on storage, so blob
// content is asserted on the putAsset call (realm-local Blob) rather than
// after a getAsset round trip; metadata (id, name, mimeType) round-trips.
import { afterEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { getAsset, getDB, getProject, putAsset, putProject, type StoredProject } from '../db/stores';
import { importProjectFromZip } from './import';

vi.mock('../db/stores', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db/stores')>();
  return {
    ...actual,
    putAsset: vi.fn(actual.putAsset),
    putProject: vi.fn(actual.putProject),
  };
});

function storedProject(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    id: 'p-1',
    name: 'One',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    pages: [],
    tokens: { byName: {} },
    nodes: {},
    blocks: [],
    globalHeaderId: null,
    globalFooterId: null,
    ...overrides,
  };
}

async function zipBlob(files: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'blob' });
}

afterEach(async () => {
  vi.clearAllMocks();
  const db = await getDB();
  await db.clear('projects');
  await db.clear('assets');
});

describe('importProjectFromZip', () => {
  it('restores the project from project.json into IndexedDB', async () => {
    const project = storedProject({ name: 'Imported' });
    const blob = await zipBlob({
      'project.json': JSON.stringify(project),
      'home/index.html': '<!doctype html><html><body>Hi</body></html>',
    });

    const id = await importProjectFromZip(blob);

    expect(id).toBe('p-1');
    expect(putProject).toHaveBeenCalledTimes(1);
    expect(putProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-1', name: 'Imported' }),
    );
    const got = await getProject('p-1');
    expect(got?.id).toBe('p-1');
    expect(got?.name).toBe('Imported');
    expect(got?.pages).toEqual([]);
    expect(got?.tokens).toEqual({ byName: {} });
  });

  it('throws when the zip has no project.json', async () => {
    const blob = await zipBlob({
      'home/index.html': '<!doctype html><html></html>',
    });
    await expect(importProjectFromZip(blob)).rejects.toThrow(
      'project.json not found in zip',
    );
    expect(putProject).not.toHaveBeenCalled();
  });

  it('extracts asset blobs into the assets store using manifest metadata', async () => {
    const project = storedProject();
    const manifest = {
      'asset-1': { name: 'photo.png', mimeType: 'image/png' },
      'asset-2': { name: 'note.txt', mimeType: 'text/plain' },
    };
    const blob = await zipBlob({
      'project.json': JSON.stringify(project),
      'assets/manifest.json': JSON.stringify(manifest),
      'assets/asset-1': 'PNG-CONTENTS',
      'assets/asset-2': 'TEXT-CONTENTS',
    });

    await importProjectFromZip(blob);

    expect(putAsset).toHaveBeenCalledTimes(2);
    expect(putAsset).toHaveBeenCalledWith(
      'asset-1',
      expect.any(Blob),
      'photo.png',
      'image/png',
    );
    expect(putAsset).toHaveBeenCalledWith(
      'asset-2',
      expect.any(Blob),
      'note.txt',
      'text/plain',
    );
    // Content integrity: the blobs handed to putAsset carry the entry bytes.
    const blob1 = (putAsset as any).mock.calls[0][1] as Blob;
    const blob2 = (putAsset as any).mock.calls[1][1] as Blob;
    expect(blob1.size).toBe(12);
    expect(blob1.type).toBe('image/png');
    expect(blob2.size).toBe(13);
    expect(blob2.type).toBe('text/plain');

    // Metadata round-trips through IndexedDB.
    const a1 = await getAsset('asset-1');
    expect(a1?.id).toBe('asset-1');
    expect(a1?.name).toBe('photo.png');
    expect(a1?.mimeType).toBe('image/png');
    expect(a1?.blob).toBeDefined();
    const a2 = await getAsset('asset-2');
    expect(a2?.name).toBe('note.txt');
    expect(a2?.mimeType).toBe('text/plain');
  });

  it('defaults asset name and mimeType when no manifest entry exists', async () => {
    const project = storedProject();
    const blob = await zipBlob({
      'project.json': JSON.stringify(project),
      'assets/asset-9': 'BINARY',
    });

    await importProjectFromZip(blob);

    expect(putAsset).toHaveBeenCalledTimes(1);
    expect(putAsset).toHaveBeenCalledWith(
      'asset-9',
      expect.any(Blob),
      'asset-9',
      'application/octet-stream',
    );
    const blob9 = (putAsset as any).mock.calls[0][1] as Blob;
    expect(blob9.size).toBe(6);
    expect(blob9.type).toBe('application/octet-stream');

    const got = await getAsset('asset-9');
    expect(got?.id).toBe('asset-9');
    expect(got?.name).toBe('asset-9');
    expect(got?.mimeType).toBe('application/octet-stream');
  });

  it('skips generated site output under assets/ (css/js)', async () => {
    const project = storedProject();
    const blob = await zipBlob({
      'project.json': JSON.stringify(project),
      'assets/css/site.css': 'body { color: red; }',
      'assets/js/site.js': 'console.log(1);',
    });

    await importProjectFromZip(blob);

    expect(putProject).toHaveBeenCalledTimes(1);
    expect(putAsset).not.toHaveBeenCalled();
    expect(await getProject('p-1')).toBeDefined();
    const all = await (await getDB()).getAll('assets');
    expect(all).toEqual([]);
  });
});
