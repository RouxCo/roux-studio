// src/components/NewProjectDialog.tsx
// New project modal: blank project or one card per template (M4 Job 7).
// Create persists via putProject/loadProject and closes via onCreated
// only on success — validation errors show inline instead.
import { useCallback, useEffect, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type { EditorStore } from '../store/useEditorStore'
import { useEditorStore } from '../store/useEditorStore'
import { createProject, loadProject } from '../db/crud'
import { putProject } from '../db/stores'
import { newProjectFromTemplate } from '../projects/newProject'
import { loadTemplate, TEMPLATE_IDS } from '../templates'
import type { TemplateMeta } from '../templates/types'

interface NewProjectDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (projectId: string) => void
}

type Choice = 'blank' | string

const PANEL =
  'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-xs p-6 border border-slate-700 bg-slate-900 rounded-xl shadow-2xl text-slate-100'

export default function NewProjectDialog({
  open,
  onClose,
  onCreated,
}: NewProjectDialogProps) {
  const [name, setName] = useState('Untitled')
  const [choice, setChoice] = useState<Choice>('blank')
  const [templates, setTemplates] = useState<{
    id: string
    meta: TemplateMeta
  }[]>([])
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const set: (partial: Partial<EditorStore>) => void = useEditorStore.setState

  useEffect(() => {
    if (!open) return
    setName('Untitled')
    setChoice('blank')
    setError('')
    loadTemplates()
  }, [open])

  async function loadTemplates() {
    const list: { id: string; meta: TemplateMeta }[] = []
    for (const id of TEMPLATE_IDS) {
      try {
        const { meta } = await loadTemplate(id)
        list.push({ id, meta })
      } catch {
        // Skip templates that fail to load.
      }
    }
    setTemplates(list)
  }

  const handleCreate = useCallback(async () => {
    if (working) return
    setError('')
    setWorking(true)
    try {
      if (choice === 'blank') {
        const id = await createProject(set)
        onCreated(id)
        return
      }
      const template = templates.find((t) => t.id === choice)
      let projectName = name
      if (choice === 'dark-premium' && name === 'Untitled' && template) {
        projectName = `${template.meta.name} site`
      }
      const project = await newProjectFromTemplate(choice, projectName)
      await putProject(project)
      await loadProject(set, project.id)
      onCreated(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setWorking(false)
    }
  }, [choice, name, templates, set, working])

  const options: {
    id: string
    label: string
    description: string
    preview?: string
  }[] = [
    { id: 'blank', label: 'Blank project', description: 'Start with an empty canvas.' },
    ...templates.map((t) => ({
      id: t.id,
      label: t.meta.name,
      description: t.meta.description,
      preview: t.meta.preview,
    })),
  ]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[55] bg-slate-900/70" onContextMenu={(e) => e.preventDefault()}>
      <div className={PANEL} onContextMenu={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2 mb-5">
          <Plus size={16} strokeWidth={2} className="text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-tight">New project</h2>
        </div>

        <label className="block text-xs text-slate-400 mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
        />

        <div className="space-y-2 mb-5">
          {options.map((option) => (
            <button
              key={option.id}
              data-choice={option.id}
              onClick={() => setChoice(option.id)}
              className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition ${
                choice === option.id
                  ? 'border-cyan-500 bg-slate-800/50 text-slate-100'
                  : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              <div
                className="flex-shrink-0 h-10 w-10 rounded-sm border border-slate-700 flex items-center justify-center"
                style={option.preview ? { background: option.preview } : undefined}
              >
                {!option.preview && <Plus size={14} strokeWidth={2} />}
              </div>
              <div className="flex-1">
                <div className="text-sm">{option.label}</div>
                <div className="text-xs text-slate-500">{option.description}</div>
              </div>
              {choice === option.id && <Check size={14} strokeWidth={2} className="text-cyan-400" />}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-xs text-rose-400 mb-4">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={working}
            onClick={handleCreate}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm text-white disabled:opacity-50 disabled:pointer-events-none hover:bg-cyan-500"
          >
            {working ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
