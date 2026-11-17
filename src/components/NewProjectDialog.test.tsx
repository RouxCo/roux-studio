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

// Template cards render only after the dynamic template imports resolve, which
// can take longer than a flush or two when the full suite is busy. Poll for the
// card instead of timing out on a null querySelector.
async function waitForChoice(container: HTMLElement, id: string) {
  const deadline = Date.now() + 5000
  const selector = '[data-choice="' + id + '"]'
  for (;;) {
    const card = container.querySelector(selector) as HTMLButtonElement | null
    if (card) return card
    if (Date.now() >= deadline) throw new Error('no template card: ' + id)
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
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

    const card = await waitForChoice(container, 'dark-premium')
    act(() => card.click())
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

  it('creates a project from the light-professional template and loads it into the store', async () => {
    const container = renderDialog()
    await flush()

    act(() => {
      const card = container.querySelector('[data-choice="light-professional"]') as HTMLButtonElement | null
      if (!card) throw new Error('no light-professional template card')
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

  it('creates a project from the local-trades template and loads it into the store', async () => {
    const container = renderDialog()
    await flush()

    act(() => {
      const card = container.querySelector('[data-choice="local-trades"]') as HTMLButtonElement | null
      if (!card) throw new Error('no local-trades template card')
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

    async function createOnce() {
      const card = await waitForChoice(container, 'dark-premium')
      act(() => card.click())
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
    const project = await newProjectFromTemplate('dark-premium', 'Acme')
    expect(project.name).toBe('Acme')
    expect(validateTemplate(project)).toEqual([])
  })

  it('returns a light-professional project whose validation is clean', async () => {
    const project = await newProjectFromTemplate('light-professional', 'Cape & Karoo Accounting')
    expect(project.name).toBe('Cape & Karoo Accounting')
    expect(validateTemplate(project)).toEqual([])
  })

  it('returns a local-trades project whose validation is clean', async () => {
    const project = await newProjectFromTemplate('local-trades', 'Cape Town Trades')
    expect(project.name).toBe('Cape Town Trades')
    expect(validateTemplate(project)).toEqual([])
  })
})

afterEach(async () => {
  document.body.innerHTML = ''
  await clearProjects()
})
