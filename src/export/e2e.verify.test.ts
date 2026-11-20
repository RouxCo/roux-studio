// src/export/e2e.verify.test.ts
// End-to-end: load a starter template, instantiate it, export to HTML + CSS,
// and assert the export contract (no inline styles, no data-node-id, r- classes).
import { describe, expect, it } from 'vitest';
import { loadTemplate, TEMPLATE_IDS } from '../templates/index';
import { validateTemplate } from '../templates/validate';
import { instantiateProject } from '../templates/instantiate';
import { exportProject } from './export';
import type { StoredProject } from '../db/stores';
import type { ExportOptions } from './types';

function buildOptions(project: StoredProject): ExportOptions {
  return { project, nodes: project.nodes };
}

describe('end-to-end template export', () => {
  for (const id of TEMPLATE_IDS) {
    it(`exports ${id} to clean HTML + CSS`, async () => {
      const { project } = await loadTemplate(id);
      const errors = validateTemplate(project);
      expect(errors).toEqual([]);

      const stored = instantiateProject(project as StoredProject, `My ${id}`);
      const result = exportProject(buildOptions(stored));

      expect(result.pages.length).toBeGreaterThan(0);
      expect(result.css.length).toBeGreaterThan(0);

      const html = result.pages[0]!.html;
      const css = result.css;

      // No inline style attributes.
      expect(html).not.toMatch(/\sstyle=/);
      // No data-node-id (editor artefact).
      expect(html).not.toMatch(/data-node-id/);
      // No Tailwind utility classes in export.
      expect(html).not.toMatch(/class="[^"]*\btw-\w+/);
      // Compiled r- classes present.
      expect(html).toMatch(/class="r-[0-9a-f]{6,}"/);
      // CSS contains r- rules.
      expect(css).toMatch(/\.r-[0-9a-f]{6,}\s*\{/);
      // Tokens emitted as :root variables.
      if (Object.keys(stored.tokens.byName).length > 0) {
        expect(css).toMatch(/--[\w-]+:/);
      }
    });
  }
});
