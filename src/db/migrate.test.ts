// src/db/migrate.test.ts
// Project schema v2 migration: v1 records (no blocks / global ids / schemaVersion)
// are patched up on read; v2 records pass through unchanged.
import { describe, expect, it } from 'vitest';

import { migrateStored, SCHEMA_VERSION } from './migrate';
import type { StoredProject } from './stores';

function v1Project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    id: 'p-1',
    name: 'Old',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    pages: [],
    tokens: { byName: {} },
    nodes: {},
    ...overrides,
  } as unknown as StoredProject;
}

describe('migrateStored', () => {
  it('fills missing v2 fields on a v1 record and sets schemaVersion 2', () => {
    const stored = migrateStored(v1Project());

    expect(stored.blocks).toEqual([]);
    expect(stored.globalHeaderId).toBeNull();
    expect(stored.globalFooterId).toBeNull();
    expect(stored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(stored.schemaVersion).toBe(2);

    // Existing fields carry over unchanged.
    expect(stored.id).toBe('p-1');
    expect(stored.name).toBe('Old');
    expect(stored.pages).toEqual([]);
    expect(stored.nodes).toEqual({});
  });

  it('keeps existing pages and nodes intact', () => {
    const stored = migrateStored(
      v1Project({
        pages: [{ id: 'pg-1', title: 'Home', slug: 'home', rootId: 'pg-1' }],
        nodes: { n1: { id: 'n1', type: 'box', parentId: null, children: [], styles: {}, hidden: {}, locked: false } },
      }),
    );

    expect(stored.pages).toEqual([{ id: 'pg-1', title: 'Home', slug: 'home', rootId: 'pg-1' }]);
    expect(stored.nodes).toHaveProperty('n1');
    expect(stored.blocks).toEqual([]);
    expect(stored.schemaVersion).toBe(2);
  });

  it('passes through a v2 record and unknown extra fields', () => {
    const stored = migrateStored(
      v1Project({
        blocks: [{ id: 'b-1', name: 'Hero', rootId: 'r-1', nodes: {} }],
        globalHeaderId: 'h-1',
        globalFooterId: null,
        schemaVersion: 2,
      }),
    );

    expect(stored.schemaVersion).toBe(2);
    expect(stored.blocks).toHaveLength(1);
    expect(stored.globalHeaderId).toBe('h-1');
    expect(stored.globalFooterId).toBeNull();
  });
});
