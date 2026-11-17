// src/templates/validate.test.ts
// Template loading, validation and instantiation (M4 Job 7).
import { beforeAll, describe, expect, it } from 'vitest';

import { loadTemplate, TEMPLATE_IDS } from '.';
import { validateTemplate } from './validate';
import { instantiateProject } from './instantiate';
import type { Node } from '../types';
import type { StoredProject } from '../db/stores';

let sample: StoredProject;

beforeAll(async () => {
  const loaded = await loadTemplate('sample');
  sample = loaded.project as StoredProject;
});

function mutate(fn: (p: StoredProject) => void): string[] {
  const copy = structuredClone(sample);
  fn(copy);
  return validateTemplate(copy);
}

function findNode(p: StoredProject, type: Node['type']): Node {
  const found = Object.values(p.nodes).find((n) => n.type === type);
  if (!found) throw new Error(`No node of type ${type} in sample`);
  return found;
}

describe('template loading', () => {
  it('loads every template id and validates clean', async () => {
    for (const id of TEMPLATE_IDS) {
      const { project } = await loadTemplate(id);
      expect(validateTemplate(project)).toEqual([]);
    }
  });

  it('sample has exactly two sections and no global header/footer', () => {
    const sections = Object.values(sample.nodes).filter((n) => n.type === 'section');
    expect(sections).toHaveLength(2);
    for (const page of sample.pages) {
      expect(page.useGlobalHeader).toBeFalsy();
      expect(page.useGlobalFooter).toBeFalsy();
    }
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
    const copy = instantiateProject(sample, 'Copy');

    expect(copy.id).not.toBe(sample.id);
    expect(copy.name).toBe('Copy');

    const srcIds = new Set(Object.keys(sample.nodes));
    const copyIds = new Set(Object.keys(copy.nodes));
    for (const id of copyIds) {
      expect(srcIds.has(id)).toBe(false);
    }
    expect(Object.keys(copy.nodes).length).toBe(Object.keys(sample.nodes).length);
    expect(copy.pages.length).toBe(sample.pages.length);

    // mutating a heading in the copy leaves the source untouched
    const copyHeading = findNode(copy, 'heading') as { id: string; text: string };
    copyHeading.text = 'changed in copy';
    const srcHeading = findNode(sample, 'heading') as { id: string; text: string };
    expect(srcHeading.text).not.toBe('changed in copy');

    expect(validateTemplate(copy)).toEqual([]);
  });
});
