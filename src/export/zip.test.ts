// src/export/zip.test.ts
// Tests for zipExport: correct zip structure (index.html per page,
// assets/css/site.css, sitemap.xml, robots.txt, 404.html), no site.js
// when js is null, non-empty blob (spec §11.1).
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { zipExport } from './zip';
import type { ExportResult } from './types';

function result(pages: ExportResult['pages'], js: string | null = null): ExportResult {
  return { pages, css: 'body { color: red; }', js };
}

const PAGE: ExportResult['pages'][number] = {
  pageId: 'pg-1',
  slug: 'home',
  path: 'home/index.html',
  html: '<!doctype html><html><body>Home</body></html>',
};

async function zipEntries(blob: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(blob);
  return Object.keys(zip.files);
}

describe('zipExport', () => {
  it('packs index.html per page plus css, sitemap, robots, 404; no site.js when js is null', async () => {
    const r = result([PAGE], null);
    const blob = await zipExport(r);
    expect(blob.size).toBeGreaterThan(0);

    const entries = await zipEntries(blob);
    expect(entries).toContain('home/index.html');
    expect(entries).toContain('assets/css/site.css');
    expect(entries).toContain('sitemap.xml');
    expect(entries).toContain('robots.txt');
    expect(entries).toContain('404.html');
    expect(entries).not.toContain('assets/js/site.js');
  });

  it('includes assets/js/site.js when js is non-null', async () => {
    const r = result([PAGE], 'console.log(1);');
    const blob = await zipExport(r);
    const entries = await zipEntries(blob);
    expect(entries).toContain('assets/js/site.js');
  });

  it('includes an entry for every page', async () => {
    const r = result([
      { ...PAGE, slug: 'home', path: 'home/index.html' },
      { ...PAGE, pageId: 'pg-2', slug: 'about', path: 'about/index.html' },
    ]);
    const blob = await zipExport(r);
    const entries = await zipEntries(blob);
    expect(entries).toContain('home/index.html');
    expect(entries).toContain('about/index.html');
  });

  it('produces a non-empty zip blob', async () => {
    const blob = await zipExport(result([PAGE], null));
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/zip');
  });

  it('embeds project.json when a project is supplied, omitted otherwise', async () => {
    const project = {
      id: 'proj-1',
      name: 'My Site',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      pages: [],
      tokens: { byName: {} },
      nodes: {},
      blocks: [],
      globalHeaderId: null,
      globalFooterId: null,
    };

    const withProject = await zipExport(result([PAGE], null), { project });
    const withoutProject = await zipExport(result([PAGE], null));

    const entriesWith = await zipEntries(withProject);
    const entriesWithout = await zipEntries(withoutProject);
    expect(entriesWith).toContain('project.json');
    expect(entriesWithout).not.toContain('project.json');

    const zip = await JSZip.loadAsync(withProject);
    const parsed = JSON.parse(
      await zip.files['project.json']!.async('string'),
    );
    expect(parsed).toMatchObject({ id: 'proj-1', name: 'My Site' });
  });
});
