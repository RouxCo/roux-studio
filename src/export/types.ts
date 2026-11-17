// src/export/types.ts
// Roux Studio — static export result types (spec §11).

import type { Node as StudioNode, NodeId, PageId, Project } from '../types';

export interface ExportOptions {
  project: Project;
  nodes: Record<NodeId, StudioNode>;
  baseUrl?: string;
  lang?: string;
}

export interface ExportPage {
  pageId: PageId;
  slug: string;
  path: string;
  html: string;
}

export interface ExportResult {
  pages: ExportPage[];
  css: string;
  js: string | null;
}
