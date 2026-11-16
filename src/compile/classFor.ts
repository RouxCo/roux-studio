// src/compile/classFor.ts
// Stable per-node class name: r-<short hex hash of the node ID>.
// Pure function — no React, no store, no DOM. Deterministic: the same node ID
// always yields the same class; different IDs yield different classes
// (collision unlikely for short IDs). M4's compileStyles turns each class into
// one CSS rule, reused across every element sharing that node ID.
// Uses the same FNV-1a 32-bit (hex, padded to at least 6 chars) as the old
// hashStyle, but keyed by node ID instead of by style.
import type { NodeId } from '../types';

export function classFor(nodeId: NodeId): string {
  let h = 2166136261;
  for (let i = 0; i < nodeId.length; i++) {
    h ^= nodeId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `r-${(h >>> 0).toString(16).padStart(6, '0')}`;
}
