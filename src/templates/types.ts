// src/templates/types.ts
// Roux Studio — template model (M4 Job 7).
//
// A template is a packaged project (JSON) plus metadata. The raw project JSON is
// validated before use, so a malformed template can never be instantiated.

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  preview: string; // CSS gradient shown in the template picker
}

export interface LoadedTemplate {
  meta: TemplateMeta;
  project: unknown; // raw JSON, validated before use
}
