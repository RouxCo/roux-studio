// src/templates/validate.test.ts
// Template loading, validation and instantiation (M4 Job 7 / M4 Job 8).
import { beforeAll, describe, expect, it } from 'vitest';

import { loadTemplate, TEMPLATE_IDS } from '.';
import { validateTemplate } from './validate';
import { instantiateProject } from './instantiate';
import type { Node } from '../types';
import type { StoredProject } from '../db/stores';

let darkPremium: StoredProject;

beforeAll(async () => {
  const loaded = await loadTemplate('dark-premium');
  darkPremium = loaded.project as StoredProject;
});

function mutate(fn: (p: StoredProject) => void): string[] {
  const copy = structuredClone(darkPremium);
  fn(copy);
  return validateTemplate(copy);
}

function findNode(p: StoredProject, type: Node['type']): Node {
  const found = Object.values(p.nodes).find((n) => n.type === type);
  if (!found) throw new Error(`No node of type ${type} in dark-premium`);
  return found;
}

function sectionsOf(p: StoredProject) {
  return Object.values(p.nodes).filter((n) => n.type === 'section');
}

describe('template loading', () => {
  it('loads every template id and validates clean', async () => {
    for (const id of TEMPLATE_IDS) {
      const { project } = await loadTemplate(id);
      expect(validateTemplate(project)).toEqual([]);
    }
  });

  it('dark-premium has five pages, all with global header and footer', () => {
    expect(darkPremium.pages).toHaveLength(5);
    for (const page of darkPremium.pages) {
      expect(page.useGlobalHeader).toBe(true);
      expect(page.useGlobalFooter).toBe(true);
    }
    expect(darkPremium.globalHeaderId).not.toBeNull();
    expect(darkPremium.globalFooterId).not.toBeNull();
    const header = darkPremium.nodes[darkPremium.globalHeaderId!];
    const footer = darkPremium.nodes[darkPremium.globalFooterId!];
    expect(header?.parentId).toBeNull();
    expect(footer?.parentId).toBeNull();

    // Globals must not be direct children of any page.
    const pageChildren = new Set<string>();
    for (const page of darkPremium.pages) {
      const root = darkPremium.nodes[page.rootId];
      if (root) {
        for (const id of root.children) pageChildren.add(id);
      }
    }
    expect(pageChildren.has(darkPremium.globalHeaderId!)).toBe(false);
    expect(pageChildren.has(darkPremium.globalFooterId!)).toBe(false);
  });

  it('has eight sections including feathered blends', () => {
    const sections = sectionsOf(darkPremium);
    expect(sections).toHaveLength(8);
    const blended = sections.filter(
      (s) => (s as { sectionBlend?: { enabled?: boolean } }).sectionBlend?.enabled,
    );
    expect(blended.length).toBeGreaterThan(0);
  });
});

describe('validateTemplate mutations', () => {
  it('reports a dangling child id', () => {
    const problems = mutate((p) => {
      const sec = findNode(p, 'section');
      sec.children.push('does-not-exist');
    });
    expect(problems.length).toBeGreaterThan(0);
  });

  it('reports a section-typed node nested in a section', () => {
    const problems = mutate((p) => {
      const sec = findNode(p, 'section');
      const nested: Node = {
        id: 'nested-section',
        type: 'section',
        parentId: sec.id,
        children: [],
        styles: {},
        hidden: {},
        locked: false,
        backgroundLayers: [],
        sectionBlend: { enabled: false, feather: 0, overlap: 0 },
      };
      p.nodes[nested.id] = nested;
      sec.children.push(nested.id);
    });
    expect(problems.length).toBeGreaterThan(0);
  });

  it('reports a style referencing var(--missing)', () => {
    const problems = mutate((p) => {
      const sec = findNode(p, 'section');
      sec.styles = { ...sec.styles, color: { desktop: 'var(--missing)' } };
    });
    expect(problems.length).toBeGreaterThan(0);
  });

  it('reports lorem ipsum copy', () => {
    const problems = mutate((p) => {
      const heading = findNode(p, 'heading') as { id: string; text: string };
      heading.text = 'lorem ipsum dolor';
    });
    expect(problems.length).toBeGreaterThan(0);
  });

  it('reports a fixed 1440px desktop width', () => {
    const problems = mutate((p) => {
      const sec = findNode(p, 'section');
      sec.styles = {
        ...sec.styles,
        width: { desktop: { kind: 'px', value: 1440 } },
      };
    });
    expect(problems.length).toBeGreaterThan(0);
  });
});

describe('instantiateProject', () => {
  it('creates an independent copy that validates clean', () => {
    const copy = instantiateProject(darkPremium, 'Copy');

    expect(copy.id).not.toBe(darkPremium.id);
    expect(copy.name).toBe('Copy');

    const srcIds = new Set(Object.keys(darkPremium.nodes));
    const copyIds = new Set(Object.keys(copy.nodes));
    for (const id of copyIds) {
      expect(srcIds.has(id)).toBe(false);
    }
    expect(Object.keys(copy.nodes).length).toBe(Object.keys(darkPremium.nodes).length);
    expect(copy.pages.length).toBe(darkPremium.pages.length);

    // mutating a heading in the copy leaves the source untouched
    const copyHeading = findNode(copy, 'heading') as { id: string; text: string };
    copyHeading.text = 'changed in copy';
    const srcHeading = findNode(darkPremium, 'heading') as { id: string; text: string };
    expect(srcHeading.text).not.toBe('changed in copy');

    expect(validateTemplate(copy)).toEqual([]);
  });
});

describe('contrast', () => {
  // Text-colour / background-colour token pairs actually used in the template.
  const pairs: [string, string][] = [
    ['color-surface', 'color-ink'], // body text on dark background
    ['color-accent', 'color-ink'], // accent headings on dark background
    ['color-muted', 'color-ink'], // muted text on dark background
    ['color-ink', 'color-accent'], // button text on accent background
  ];

  function luminance(hex: string): number {
    const rgb = hex.slice(1).match(/[0-9a-f]{2}/gi)!.map((v) => parseInt(v, 16) / 255);
    const lin = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  }

  function contrast(a: string, b: string): number {
    const la = luminance(a);
    const lb = luminance(b);
    const light = Math.max(la, lb);
    const dark = Math.min(la, lb);
    return (light + 0.05) / (dark + 0.05);
  }

  it('meets text-colour contrast ratios (4.5:1, 3:1 for large headings)', () => {
    const byName = darkPremium.tokens.byName as Record<string, { value: string }>;
    const token = (name: string): string => byName[name]!.value;
    for (const [fg, bg] of pairs) {
      const ratio = contrast(token(fg), token(bg));
      // All pairs clear 4.5:1, hence also the relaxed 3:1 large-heading threshold.
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
