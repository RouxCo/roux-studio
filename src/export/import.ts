// src/export/import.ts
// Roux Studio — .roux.zip import (spec §11.3).
//
// Reads a zip produced by zipExport / exportProjectToZip, restores the source
// project into IndexedDB via putProject, and extracts any asset blobs from
// `assets/` entries into the assets store via putAsset. Returns the restored
// project's id.

import JSZip from 'jszip';
import { putAsset, putProject } from '../db/stores';
import type { StoredProject } from '../db/stores';

interface AssetMeta {
  name: string;
  mimeType: string;
}

// Generated site output plus the asset metadata manifest — never restored
// into the asset store; site output is regenerated on the next export.
const SITE_OUTPUT = new Set([
  'assets/css/site.css',
  'assets/js/site.js',
  'assets/manifest.json',
]);

async function readManifest(
  zip: JSZip,
): Promise<Record<string, AssetMeta>> {
  const entry = zip.files['assets/manifest.json'];
  if (!entry) return {};
  const text = await entry.async('string');
  try {
    return JSON.parse(text) as Record<string, AssetMeta>;
  } catch {
    return {};
  }
}

export async function importProjectFromZip(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(blob);

  const projectEntry = zip.files['project.json'];
  if (!projectEntry) {
    throw new Error('project.json not found in zip');
  }

  const project = (JSON.parse(
    await projectEntry.async('string'),
  ) as unknown) as StoredProject;
  await putProject(project);

  const manifest = await readManifest(zip);

  for (const [path, entry] of Object.entries(zip.files)) {
    if (!path.startsWith('assets/') || path === 'assets/' || entry.dir) {
      continue;
    }
    if (SITE_OUTPUT.has(path)) continue;

    const id = path.slice('assets/'.length);
    const meta = manifest[id] ?? { name: id, mimeType: 'application/octet-stream' };
    const data = await entry.async('arraybuffer');
    await putAsset(
      id,
      new Blob([data], { type: meta.mimeType }),
      meta.name,
      meta.mimeType,
    );
  }

  return project.id;
}
