// src/db/migrate.ts
// Project schema migration (spec §4.7).
//
// IndexedDB object stores do not change, so DB_VERSION stays 1 (see stores.ts).
// v2 adds blocks, globalHeaderId and globalFooterId to stored projects plus a
// schemaVersion marker. Records written by v1 (no schemaVersion) are patched up
// on read so they carry the new fields; unknown extra fields pass through.

import type { StoredProject } from './stores';

export const SCHEMA_VERSION = 2;

/** Bring a stored project up to schema v2, filling in any missing v2 fields. */
export function migrateStored(raw: StoredProject): StoredProject {
  return {
    ...raw,
    blocks: raw.blocks ?? [],
    globalHeaderId: raw.globalHeaderId ?? null,
    globalFooterId: raw.globalFooterId ?? null,
    schemaVersion: SCHEMA_VERSION,
  };
}
