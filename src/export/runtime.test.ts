// src/export/runtime.test.ts
// Tests for runtimeSource: null for empty module set, IntersectionObserver
// + .is-in for 'animations', gzipped size under 8 KB (spec §9.3).
import { describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { runtimeSource } from './runtime';

describe('runtimeSource', () => {
  it('returns null for an empty module set (tree-shake everything)', () => {
    expect(runtimeSource(new Set())).toBeNull();
  });

  it('returns null for an unrecognized module set', () => {
    expect(runtimeSource(new Set(['unknown']))).toBeNull();
  });

  it('produces a non-empty string containing IntersectionObserver and .is-in for animations', () => {
    const source = runtimeSource(new Set(['animations']))!;
    expect(typeof source).toBe('string');
    expect(source.length).toBeGreaterThan(0);
    expect(source).toContain('IntersectionObserver');
    expect(source).toContain("'is-in'");
  });

  it('produces video lazy-load source for video-lazy-load module', () => {
    const source = runtimeSource(new Set(['video-lazy-load']))!;
    expect(typeof source).toBe('string');
    expect(source.length).toBeGreaterThan(0);
    expect(source).toContain('data-src');
    expect(source).not.toContain('IntersectionObserver');
  });

  it('combines multiple modules into one source', () => {
    const source = runtimeSource(new Set(['animations', 'video-lazy-load']))!;
    expect(source).toContain('IntersectionObserver');
    expect(source).toContain("'is-in'");
    expect(source).toContain('data-src');
  });

  it('gzipped animations-only source is under 8 KB', () => {
    const source = runtimeSource(new Set(['animations']))!;
    const gzipped = gzipSync(source);
    expect(gzipped.length).toBeLessThan(8192);
  });

  it('gzipped combined source is under 8 KB', () => {
    const source = runtimeSource(new Set(['animations', 'video-lazy-load']))!;
    const gzipped = gzipSync(source);
    expect(gzipped.length).toBeLessThan(8192);
  });
});
