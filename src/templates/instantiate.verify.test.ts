// src/templates/instantiate.verify.test.ts
// Verifies each of the 4 starter templates loads, validates, and instantiates
// into a fresh project with remapped ids and no dangling references.
import { describe, expect, it } from 'vitest';
import { loadTemplate, TEMPLATE_IDS } from './index';
import { validateTemplate } from './validate';
import { instantiateProject } from './instantiate';
import type { StoredProject } from '../db/stores';

describe('template instantiation', () => {
  for (const id of TEMPLATE_IDS) {
    it(`loads, validates and instantiates ${id}`, async () => {
      const { meta, project } = await loadTemplate(id);
      expect(meta.id).toBe(id);
      expect(meta.name.length).toBeGreaterThan(0);

      const errors = validateTemplate(project);
      expect(errors).toEqual([]);

      const templateProject = project as StoredProject;
      const stored = instantiateProject(
        templateProject,
        `My ${meta.name}`,
      );
      expect(stored.id).not.toBe(templateProject.id);
      expect(stored.name).toBe(`My ${meta.name}`);
      expect(stored.pages.length).toBeGreaterThan(0);

      // Every page root exists and every node reference resolves.
      const nodeIds = new Set(Object.keys(stored.nodes));
      for (const page of stored.pages) {
        expect(nodeIds.has(page.rootId)).toBe(true);
        expect(stored.nodes[page.rootId]!.type).toBe('page');
      }
      if (stored.globalHeaderId) expect(nodeIds.has(stored.globalHeaderId)).toBe(true);
      if (stored.globalFooterId) expect(nodeIds.has(stored.globalFooterId)).toBe(true);
      for (const block of stored.blocks) {
        expect(nodeIds.has(block.rootId)).toBe(true);
      }
    });
  }
});
