// src/components/NewProjectDialog.test.tsx
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import 'fake-indexeddb/auto'
import { emptyEditorData } from '../types'
import { useEditorStore } from '../store/useEditorStore'
import { getProject } from '../db/stores'
import { newProjectFromTemplate } from '../projects/newProject'
import { validateTemplate } from '../templates/validate'
import NewProjectDialog from './NewProjectDialog'

const createdIds: string[] = []

async function clearProjects() {
  const { getDB } = await import('../db/stores')
  const db = await getDB()
  await db.clear('projects')
}

beforeEach(async () => {
  createdIds.length = 0
  useEditorStore.setState({
    ...emptyEditorData(),
    history: [],
    historyIndex: -1,
  })
  await clearProjects()
})

function renderDialog() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let root!: ReturnType<typeof createRoot>
  act(() => {
    root = createRoot(container)
    root.render(
      <NewProjectDialog
        open
        onClose={() => {}}
        onCreated={(id) => {
          createdIds.push(id)
        }}
      />
    )
  })
  return container
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 50))
}

function clickCreate(container: HTMLElement) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === 'Create',
  ) as HTMLButtonElement | undefined
  if (!button) throw new Error('no Create button')
  act(() => button.click())
}

describe('New project dialog', () => {
  it('creates a blank project', async () => {
    const container = renderDialog()
    await flush()

    clickCreate(container)
    await flush()
    await flush()

    expect(createdIds).toHaveLength(1)
    expect(useEditorStore.getState().projectId).toBe(createdIds[0])
    const stored = await getProject(createdIds[0]!)
    expect(stored).toBeDefined()
    expect(stored!.pages).toEqual([])
  })

  it('creates a project from the Sample template and loads it into the store', async () => {
    const container = renderDialog()
    await flush()

    act(() => {
      const card = container.querySelector('[data-choice="sample"]') as HTMLButtonElement | null
      if (!card) throw new Error('no Sample template card')
      card.click()
    })
    clickCreate(container)
    await flush()
    await flush()

    expect(createdIds).toHaveLength(1)
    const id = createdIds[0]!
    expect(useEditorStore.getState().projectId).toBe(id)

    const stored = await getProject(id)
    expect(stored).toBeDefined()
    expect(stored!.pages.length).toBeGreaterThan(0)
    expect(Object.keys(stored!.nodes).length).toBeGreaterThan(0)
  })

  it('creates twice with different page-node ids', async () => {
    const container = renderDialog()
    await flush()

    async function createOnce() {
      act(() => {
        const card = container.querySelector('[data-choice="sample"]') as HTMLButtonElement | null
        if (!card) throw new Error('no Sample template card')
        card.click()
      })
      clickCreate(container)
      await flush()
      await flush()
    }

    await createOnce()
    const id1 = createdIds[0]!
    await createOnce()
    const id2 = createdIds[1]!
    expect(id1).not.toBe(id2)

    const stored1 = await getProject(id1)
    const stored2 = await getProject(id2)
    expect(stored1!.pages[0]!.rootId).not.toBe(stored2!.pages[0]!.rootId)
    expect(Object.keys(stored1!.nodes)).not.toEqual(
      Object.keys(stored2!.nodes),
    )
  })
})

describe('newProjectFromTemplate', () => {
  it('returns an Acme-named project whose validation is clean', async () => {
    const project = await newProjectFromTemplate('sample', 'Acme')
    expect(project.name).toBe('Acme')
    expect(validateTemplate(project)).toEqual([])
  })
})

afterEach(async () => {
  document.body.innerHTML = ''
  await clearProjects()
})
