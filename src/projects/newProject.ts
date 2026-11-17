// src/projects/newProject.ts
// Build a new project from a template without persisting it.
// Persistence (putProject + loadProject) is the caller's job.
import { loadTemplate, TEMPLATE_IDS } from '../templates'
import { validateTemplate } from '../templates/validate'
import { instantiateProject } from '../templates/instantiate'
import type { StoredProject } from '../db/stores'

export async function newProjectFromTemplate(
  templateId: string,
  name: string,
): Promise<StoredProject> {
  const { project } = await loadTemplate(
    templateId as (typeof TEMPLATE_IDS)[number],
  )
  const errors = validateTemplate(project)
  if (errors.length > 0) {
    throw new Error('Invalid template: ' + errors.join('; '))
  }
  return instantiateProject(project as StoredProject, name)
}
