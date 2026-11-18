// src/export/signoff.test.ts
// M4 sign-off: export every template (dark-premium, light-professional,
// local-trades, beauty-clinic) and confirm no style=, no data-node-id, and no
// canvas widths (1440 / 768 / 390 px) anywhere in exported HTML or CSS.
//
// Class hashes (r-<hex>) are compiled output, not canvas widths, but their hex
// digits can incidentally contain 1440/768/390 (e.g. r-53ec390). Those are
// stripped before the width check so it only flags real width values.
import { expect, it } from 'vitest';
import { TEMPLATE_IDS, loadTemplate } from '../templates/index';
import { instantiateProject } from '../templates/instantiate';
import { validateTemplate } from '../templates/validate';
import { exportProject } from './export';
import type { StoredProject } from '../db/stores';

const BAD_WIDTHS = /1440|768|390/;
// Compiled class hashes are not canvas widths; remove them so the width regex
// only sees real content (values, media queries, …).
const stripHashes = (s: string) => s.replace(/r-[0-9a-f]+/g, '');

it.each(TEMPLATE_IDS)('%s exports cleanly', async (id) => {
  const { project } = await loadTemplate(id);
  const stored = project as StoredProject;

  // Fresh IDs, then validation must come back clean.
  const instantiated = instantiateProject(stored, 'Signoff');
  const problems = validateTemplate(instantiated);
  expect(problems).toEqual([]);

  const { pages, css } = exportProject({
    project: instantiated,
    nodes: instantiated.nodes,
  });

  expect(pages.length).toBeGreaterThan(0);
  const cleanCss = stripHashes(css);
  for (const page of pages) {
    expect(page.html).not.toMatch(/style=/);
    expect(page.html).not.toMatch(/data-node-id/);
    expect(stripHashes(page.html)).not.toMatch(BAD_WIDTHS);
    expect(cleanCss).not.toMatch(BAD_WIDTHS);
  }
});
