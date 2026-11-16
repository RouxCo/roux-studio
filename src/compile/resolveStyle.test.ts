// src/compile/resolveStyle.test.ts
import { describe, expect, it } from 'vitest';
import type { Node, ResponsiveStyles } from '../types';
import { resolveStyle } from './resolveStyle';

function node(styles: ResponsiveStyles): Node {
  return {
    id: 'n-1', type: 'box', parentId: null, children: [], styles,
    hidden: {}, locked: false,
  };
}

describe('resolveStyle', () => {
  it('resolves the desktop value at desktop breakpoint', () => {
    const n = node({ width: { desktop: { kind: 'px', value: 1440 } } });
    expect(resolveStyle(n, 'desktop', 'width')).toEqual({ kind: 'px', value: 1440 });
  });

  it('resolves the tablet override at tablet, overriding desktop', () => {
    const n = node({ width: { desktop: { kind: 'px', value: 1440 }, tablet: { kind: 'px', value: 768 } } });
    expect(resolveStyle(n, 'tablet', 'width')).toEqual({ kind: 'px', value: 768 });
    expect(resolveStyle(n, 'desktop', 'width')).toEqual({ kind: 'px', value: 1440 });
  });

  it('resolves the mobile override at mobile, winning over tablet and desktop', () => {
    const n = node({
      width: {
        desktop: { kind: 'px', value: 1440 },
        tablet: { kind: 'px', value: 768 },
        mobile: { kind: 'px', value: 390 },
      },
    });
    expect(resolveStyle(n, 'mobile', 'width')).toEqual({ kind: 'px', value: 390 });
    expect(resolveStyle(n, 'tablet', 'width')).toEqual({ kind: 'px', value: 768 });
    expect(resolveStyle(n, 'desktop', 'width')).toEqual({ kind: 'px', value: 1440 });
  });

  it('mobile falls back to desktop when mobile is unset, even if tablet is set', () => {
    const n = node({ width: { desktop: { kind: 'px', value: 1440 }, tablet: { kind: 'px', value: 768 } } });
    expect(resolveStyle(n, 'mobile', 'width')).toEqual({ kind: 'px', value: 1440 });
  });

  it('mobile falls back to desktop when mobile and tablet are unset', () => {
    const n = node({ width: { desktop: { kind: 'px', value: 1440 } } });
    expect(resolveStyle(n, 'mobile', 'width')).toEqual({ kind: 'px', value: 1440 });
    expect(resolveStyle(n, 'tablet', 'width')).toEqual({ kind: 'px', value: 1440 });
  });

  it('tablet falls back to desktop when tablet is unset', () => {
    const n = node({ width: { desktop: { kind: 'px', value: 1440 } } });
    expect(resolveStyle(n, 'tablet', 'width')).toEqual({ kind: 'px', value: 1440 });
  });

  it('resolves non-length values (display, color, fontSize)', () => {
    const n = node({
      display: { desktop: 'flex', mobile: 'block' },
      color: { desktop: '#0f766e', mobile: '#e2e8f0' },
      fontSize: { desktop: { kind: 'px', value: 16 }, mobile: { kind: 'px', value: 14 } },
    });
    expect(resolveStyle(n, 'desktop', 'display')).toBe('flex');
    expect(resolveStyle(n, 'mobile', 'display')).toBe('block');
    expect(resolveStyle(n, 'desktop', 'color')).toBe('#0f766e');
    expect(resolveStyle(n, 'mobile', 'color')).toBe('#e2e8f0');
    expect(resolveStyle(n, 'desktop', 'fontSize')).toEqual({ kind: 'px', value: 16 });
    expect(resolveStyle(n, 'mobile', 'fontSize')).toEqual({ kind: 'px', value: 14 });
  });

  it('returns undefined when the key is not set on the node', () => {
    const n = node({ width: { desktop: { kind: 'px', value: 100 } } });
    expect(resolveStyle(n, 'desktop', 'height')).toBeUndefined();
    expect(resolveStyle(n, 'tablet', 'color')).toBeUndefined();
  });

  it('an explicitly undefined breakpoint value falls through to desktop', () => {
    const n = node({ width: { desktop: { kind: 'px', value: 100 }, mobile: undefined as any } });
    expect(resolveStyle(n, 'mobile', 'width')).toEqual({ kind: 'px', value: 100 });
  });
});
