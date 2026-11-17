// src/templates/validate.test.ts
// Template loading, validation and instantiation (M4 Job 7 / M4 Job 8).
import { beforeAll, describe, expect, it } from 'vitest';

import { loadTemplate, TEMPLATE_IDS } from '.';
import { validateTemplate } from './validate';
import { instantiateProject } from './instantiate';
import type { Node } from '../types';
import type { StoredProject } from '../db/stores';

let darkPremium: StoredProject;
let lightProfessional: StoredProject;
let localTrades: StoredProject;
let beautyClinic: StoredProject;

beforeAll(async () => {
  const [darkLoaded, lightLoaded, localLoaded, beautyLoaded] = await Promise.all([
    loadTemplate('dark-premium'),
    loadTemplate('light-professional'),
    loadTemplate('local-trades'),
    loadTemplate('beauty-clinic'),
  ]);
  darkPremium = darkLoaded.project as StoredProject;
  lightProfessional = lightLoaded.project as StoredProject;
  localTrades = localLoaded.project as StoredProject;
  beautyClinic = beautyLoaded.project as StoredProject;
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

function pageGlobalChecks(p: StoredProject) {
  expect(p.pages).toHaveLength(5);
  for (const page of p.pages) {
    expect(page.useGlobalHeader).toBe(true);
    expect(page.useGlobalFooter).toBe(true);
  }
  expect(p.globalHeaderId).not.toBeNull();
  expect(p.globalFooterId).not.toBeNull();
  const header = p.nodes[p.globalHeaderId!];
  const footer = p.nodes[p.globalFooterId!];
  expect(header?.parentId).toBeNull();
  expect(footer?.parentId).toBeNull();

  // Globals must not be direct children of any page.
  const pageChildren = new Set<string>();
  for (const page of p.pages) {
    const root = p.nodes[page.rootId];
    if (root) {
      for (const id of root.children) pageChildren.add(id);
    }
  }
  expect(pageChildren.has(p.globalHeaderId!)).toBe(false);
  expect(pageChildren.has(p.globalFooterId!)).toBe(false);
}

function featheredBlends(p: StoredProject) {
  return sectionsOf(p).filter(
    (s) => (s as { sectionBlend?: { enabled?: boolean } }).sectionBlend?.enabled,
  );
}

describe('template loading', () => {
  it('loads every template id and validates clean', async () => {
    for (const id of TEMPLATE_IDS) {
      const { project } = await loadTemplate(id);
      expect(validateTemplate(project)).toEqual([]);
    }
  });

  it('dark-premium has five pages, all with global header and footer', () => {
    pageGlobalChecks(darkPremium);
  });

  it('light-professional has five pages, all with global header and footer', () => {
    pageGlobalChecks(lightProfessional);
  });

  it('has eight sections including feathered blends', () => {
    const sections = sectionsOf(darkPremium);
    expect(sections).toHaveLength(8);
    expect(featheredBlends(darkPremium).length).toBeGreaterThan(0);
  });

  it('light-professional has a feathered section blend', () => {
    expect(featheredBlends(lightProfessional).length).toBeGreaterThan(0);
  });

  it('local-trades has five pages, all with global header and footer', () => {
    pageGlobalChecks(localTrades);
  });

  it('local-trades has a feathered section blend', () => {
    expect(featheredBlends(localTrades).length).toBeGreaterThan(0);
  });

  it('beauty-clinic has five pages, all with global header and footer', () => {
    pageGlobalChecks(beautyClinic);
  });

  it('beauty-clinic has a feathered section blend', () => {
    expect(featheredBlends(beautyClinic).length).toBeGreaterThan(0);
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

function tokenOf(project: StoredProject) {
  const byName = project.tokens.byName as Record<string, { value: string }>;
  return (name: string): string => byName[name]!.value;
}

describe('contrast', () => {
  it('dark-premium meets text-colour contrast ratios (4.5:1, 3:1 for large headings)', () => {
    // Text-colour / background-colour token pairs actually used in the template.
    const pairs: [string, string][] = [
      ['color-surface', 'color-ink'], // body text on dark background
      ['color-accent', 'color-ink'], // accent headings on dark background
      ['color-muted', 'color-ink'], // muted text on dark background
      ['color-ink', 'color-accent'], // button text on accent background
    ];
    const token = tokenOf(darkPremium);
    for (const [fg, bg] of pairs) {
      const ratio = contrast(token(fg), token(bg));
      // All pairs clear 4.5:1, hence also the relaxed 3:1 large-heading threshold.
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('light-professional meets text-colour contrast ratios (4.5:1, 3:1 for large headings)', () => {
    // Text-colour / background-colour token pairs actually used in the template.
    const pairs: [string, string][] = [
      ['color-ink', 'color-bg'], // body and heading text on light background
      ['color-accent', 'color-bg'], // accent headings on light background
      ['color-muted', 'color-bg'], // muted text on light background
      ['color-surface', 'color-accent'], // button text on accent background
    ];
    const token = tokenOf(lightProfessional);
    for (const [fg, bg] of pairs) {
      const ratio = contrast(token(fg), token(bg));
      // All pairs clear 4.5:1, hence also the relaxed 3:1 large-heading threshold.
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('local-trades meets text-colour contrast ratios (4.5:1, 3:1 for large headings)', () => {
    // Text-colour / background-colour token pairs actually used in the template.
    const pairs: [string, string][] = [
      ['color-ink', 'color-bg'], // heading and body text on light sections
      ['color-muted', 'color-bg'], // muted text on light sections
      ['color-surface', 'color-accent'], // hero text on accent background
      ['color-accent', 'color-surface'], // price text on card surface
      ['color-ink', 'color-whatsapp'], // WhatsApp button text on WhatsApp background
    ];
    const token = tokenOf(localTrades);
    for (const [fg, bg] of pairs) {
      const ratio = contrast(token(fg), token(bg));
      // All pairs clear 4.5:1, hence also the relaxed 3:1 large-heading threshold.
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('beauty-clinic meets text-colour contrast ratios (4.5:1, 3:1 for large headings)', () => {
    // Text-colour / background-colour token pairs actually used in the template.
    const pairs: [string, string][] = [
      ['color-ink', 'color-bg'], // heading and body text on cream sections
      ['color-accent', 'color-bg'], // accent headings on cream sections
      ['color-muted', 'color-bg'], // muted text on cream sections
      ['color-surface', 'color-booking'], // booking text on deep warm background
      ['color-surface', 'color-accent'], // hero text on accent background
    ];
    const token = tokenOf(beautyClinic);
    for (const [fg, bg] of pairs) {
      const ratio = contrast(token(fg), token(bg));
      // All pairs clear 4.5:1, hence also the relaxed 3:1 large-heading threshold.
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
