// src/export/export.test.ts
// Tests for exportProject: one HTML page per page, compiled r-<hash> classes,
// no inline `style=`, no `data-node-id` in export output (spec §11, §11.2).
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { Node, NodeId, PageId, Project } from '../types';
import { exportProject, exportProjectToZip } from './export';

function mkPage(id: PageId, rootId: string, title = 'Home'): Project['pages'][number] {
  return { id, title, slug: id, rootId };
}

function mkToken(name: string, value: string, type: Project['tokens']['byName'][string]['type'] = 'color') {
  return { name, value, type };
}

function mkProject(
  pages: Project['pages'],
  tokens: Record<string, Project['tokens']['byName'][string]> = {},
  globalHeaderId: NodeId | null = null,
  globalFooterId: NodeId | null = null,
): Project {
  return {
    id: 'proj-1',
    name: 'Roux Studio',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    pages,
    tokens: { byName: tokens },
    blocks: [],
    globalHeaderId,
    globalFooterId,
  };
}

const ROOT = 'page-1';
const SEC = 'sec-1';
const H = 'h-1';

const TREE: Record<string, Node> = {
  [ROOT]: {
    id: ROOT, type: 'page', parentId: null, children: [SEC], styles: {}, hidden: {}, locked: false,
    title: 'Home', slug: 'home', backgroundLayers: [],
  },
  [SEC]: {
    id: SEC, type: 'section', parentId: ROOT, children: [H], styles: {}, hidden: {}, locked: false,
    backgroundLayers: [], sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  },
  [H]: {
    id: H, type: 'heading', parentId: SEC, children: [], styles: {
      color: { desktop: '#0f766e' },
    }, hidden: {}, locked: false, level: 1, text: 'Welcome to Roux',
  },
};

describe('exportProject', () => {
  it('produces exactly one page HTML with doctype, main, heading, r- class, no style= / data-node-id', () => {
    const p = mkProject([mkPage('pg-1', ROOT)]);
    const result = exportProject({ project: p, nodes: TREE });

    expect(result.pages).toHaveLength(1);
    const page = result.pages[0]!;
    expect(page.path).toBe('pg-1/index.html');
    expect(page.html).toContain('<!doctype html>');
    expect(page.html).toMatch(new RegExp(`<div[^>]*class="r-[0-9a-f]{6,}"`));
    expect(page.html).toContain('Welcome to Roux');
    expect(page.html).not.toMatch(/style=/);
    expect(page.html).not.toMatch(/data-node-id/);
  });

  it('wraps page body in a single root div element', () => {
    const p = mkProject([mkPage('pg-1', ROOT)]);
    const result = exportProject({ project: p, nodes: TREE });
    const page = result.pages[0]!;
    const rootDivs = page.html.match(/<div[^>]*class="r-[0-9a-f]{6,}"[^>]*>/g);
    expect(rootDivs).not.toBeNull();
    expect(rootDivs!.length).toBeGreaterThanOrEqual(1);
    expect(page.html).toContain('</div>');
  });

  it('emits compiled CSS with r-<hash> rules and no inline styles', () => {
    const p = mkProject([mkPage('pg-1', ROOT)], {
      'color-primary': mkToken('color-primary', '#0f766e', 'color'),
    });
    const result = exportProject({ project: p, nodes: TREE });
    expect(result.css).toContain(':root {');
    expect(result.css).toContain('--color-primary: #0f766e;');
    expect(result.css).toMatch(/r-[0-9a-f]{6,}/);
    expect(result.css).not.toMatch(/style=/);
  });

  it('returns js: null when no runtime modules are requested', () => {
    const p = mkProject([mkPage('pg-1', ROOT)]);
    const result = exportProject({ project: p, nodes: TREE });
    expect(result.js).toBeNull();
  });

  it('skips pages whose root node is missing instead of throwing', () => {
    const p = mkProject([mkPage('pg-1', 'missing-root')]);
    const result = exportProject({ project: p, nodes: TREE });
    expect(result.pages).toHaveLength(0);
    expect(result.css).toBe('');
  });

  it('uses a custom lang attribute when provided', () => {
    const p = mkProject([mkPage('pg-1', ROOT)]);
    const result = exportProject({ project: p, nodes: TREE, lang: 'af' });
    expect(result.pages[0]!.html).toContain('<html lang="af">');
  });

  it('exportProjectToZip returns a zip blob containing project.json', async () => {
    const p = mkProject([mkPage('pg-1', ROOT)]);
    const blob = await exportProjectToZip({ project: p, nodes: TREE });

    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/zip');

    const zip = await JSZip.loadAsync(blob);
    expect(zip.files['pg-1/index.html']).toBeDefined();
    expect(zip.files['assets/css/site.css']).toBeDefined();
    expect(zip.files['project.json']).toBeDefined();

    const parsed = JSON.parse(
      await zip.files['project.json']!.async('string'),
    );
    expect(parsed).toMatchObject({ id: 'proj-1', name: 'Roux Studio' });
    expect(parsed.pages).toHaveLength(1);
  });
});
