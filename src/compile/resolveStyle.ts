// src/compile/resolveStyle.ts
// Roux Studio — compile helpers.
//
// Resolves a single responsive style key on a node at a breakpoint
// (desktop-first: mobile ?? tablet ?? desktop via resolveResponsive).
// Pure: no React, no store, no DOM.
import type { Breakpoint, Node, Responsive, ResponsiveStyles } from '../types';
import { resolveResponsive } from '../types';

type StyleValue<K extends keyof ResponsiveStyles> =
  ResponsiveStyles[K] extends Responsive<infer T> ? T : never;

export function resolveStyle<K extends keyof ResponsiveStyles>(
  node: Node,
  bp: Breakpoint,
  key: K,
): StyleValue<K> | undefined {
  const styles = node.styles as Record<string, Responsive<unknown> | undefined>;
  return resolveResponsive(bp, styles[key]) as StyleValue<K> | undefined;
}
