// src/templates/index.ts
// Roux Studio — template loader registry (M4 Job 7).
//
// Each template is loaded through its own static import so Vite emits one chunk
// per template (the template JSON is not bundled into the main chunk).

import type { LoadedTemplate, TemplateMeta } from './types';

const LOADERS = {
  sample: () =>
    Promise.all([
      import('./sample/project.json'),
      import('./sample/meta'),
    ]),
} as const;

export const TEMPLATE_IDS = Object.keys(LOADERS) as Array<keyof typeof LOADERS>;

export async function loadTemplate(
  id: (typeof TEMPLATE_IDS)[number],
): Promise<LoadedTemplate> {
  const loader = LOADERS[id];
  if (!loader) {
    throw new Error(`Unknown template: ${id}`);
  }
  const [projectModule, metaModule] = await loader();
  const meta = metaModule.default as TemplateMeta;
  const project = projectModule.default as unknown;
  return { meta, project };
}
