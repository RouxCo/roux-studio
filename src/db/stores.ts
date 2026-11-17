// src/db/stores.ts
// Roux Studio IndexedDB layer (spec §4.7).
//
// Two stores:
//   - projects: full project records (pages + design tokens + flat nodes map),
//               keyed by project id. A stored project restores completely.
//   - assets:   asset blobs, keyed by asset id. Metadata (name, mimeType,
//               size) travels with the blob; no base64 in project JSON.
//
// All access goes through the lazily-opened `getDB()` singleton so the
// IndexedDB connection is opened once per tab.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Asset, Block, DesignTokens, Node, NodeId, Page } from '../types';

const DB_NAME = 'roux-studio';
const DB_VERSION = 1;

/** A persisted project: everything needed to restore an editor session. */
export interface StoredProject {
  id: string;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  pages: Page[];
  tokens: DesignTokens;
  nodes: Record<NodeId, Node>;
  blocks: Block[];
  globalHeaderId: NodeId | null;
  globalFooterId: NodeId | null;
  schemaVersion?: number;
}

/** Lightweight project listing entry (id + name + updatedAt). */
export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

/** An asset blob plus its metadata. */
export interface StoredAsset {
  id: string;
  blob: Blob;
  name: string;
  mimeType: string;
}

/** Derive the public Asset record from a stored asset. */
export function assetRecord(stored: StoredAsset): Asset {
  return {
    id: stored.id,
    name: stored.name,
    mimeType: stored.mimeType,
    size: stored.blob.size,
  };
}

/** Derive a lightweight listing entry from a stored project. */
export function projectSummary(p: StoredProject): ProjectSummary {
  return { id: p.id, name: p.name, updatedAt: p.updatedAt };
}

interface RouxSchema extends DBSchema {
  projects: {
    key: string; // out-of-line string key (project id)
    value: StoredProject;
  };
  assets: {
    key: string; // out-of-line string key (asset id)
    value: StoredAsset;
  };
}

type RouxDB = IDBPDatabase<RouxSchema>;

let dbInstance: RouxDB | null = null;

/** Open (once) and return the shared IndexedDB connection. */
export async function getDB(): Promise<RouxDB> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<RouxSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('projects')) {
        // No keyPath / autoIncrement: keys supplied out-of-line on put.
        db.createObjectStore('projects');
      }
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets');
      }
    },
  });
  return dbInstance;
}

/* ---------- projects ---------- */

export async function getProject(id: string): Promise<StoredProject | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function getAllProjects(): Promise<StoredProject[]> {
  const db = await getDB();
  return db.getAll('projects');
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await getDB();
  const projects = await db.getAll('projects');
  return projects.map(projectSummary).sort((a, b) => {
    if (a.updatedAt < b.updatedAt) return 1;
    if (a.updatedAt > b.updatedAt) return -1;
    return 0;
  });
}

export async function putProject(project: StoredProject): Promise<void> {
  const db = await getDB();
  await db.put('projects', project, project.id);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
}

/* ---------- assets ---------- */

export async function getAsset(id: string): Promise<StoredAsset | undefined> {
  const db = await getDB();
  return db.get('assets', id);
}

export async function putAsset(
  id: string,
  blob: Blob,
  name: string,
  mimeType: string,
): Promise<void> {
  const db = await getDB();
  await db.put('assets', { id, blob, name, mimeType }, id);
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('assets', id);
}

export async function getAllAssets(): Promise<StoredAsset[]> {
  const db = await getDB();
  return db.getAll('assets');
}
