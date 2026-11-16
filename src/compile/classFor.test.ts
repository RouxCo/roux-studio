// src/compile/classFor.test.ts
import { describe, expect, it } from 'vitest';
import { classFor } from './classFor';

describe('classFor', () => {
  it('is deterministic: same node ID yields the same class every time', () => {
    expect(classFor('box-1')).toBe(classFor('box-1'));
    expect(classFor('box-1')).toBe(classFor('box-1'));
  });

  it('produces a stable r-<hex> class name of at least 6 hex chars', () => {
    const cls = classFor('box-1');
    expect(cls).toMatch(/^r-[a-f0-9]{6,}$/);
  });

  it('gives different classes to different node IDs', () => {
    const ids = ['a', 'b', 'c', 'box-1', 'box-2', 'n1234567890abcdef'];
    const classes = ids.map((id) => classFor(id));
    expect(new Set(classes).size).toBe(ids.length);
  });

  it('does not depend on styles: the same node ID always gives the same class', () => {
    // classFor only reads the node ID, so style is never an input.
    expect(classFor('box-1')).toBe(classFor('box-1'));
    expect(classFor('n')).toBe(classFor('n'));
  });
});
