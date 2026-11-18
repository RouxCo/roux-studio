// src/export/types.ts
// Roux Studio — static export result types (spec §11).

import type { Node as StudioNode, NodeId, PageId, Project } from '../types';

export interface ExportOptions {
  project: Project;
  nodes: Record<NodeId, StudioNode>;
  baseUrl?: string;
  lang?: string;
  // When true, referenced image assets are served as WebP with a PNG/JPEG
  // fallback in the exported zip (<picture> + source, no transcoding lib).
  webp?: boolean;
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
