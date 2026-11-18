// src/components/ExportDialog.test.tsx
// M5 Job 9 — export dialog: pre-export checks, disable rules and downloads.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store/useEditorStore'
import { emptyEditorData, type Node, type Page } from '../types'
import ExportDialog from './ExportDialog'
import * as zipExportModule from '../export/zip'

const createdUrls: string[] = []

beforeEach(() => {
  useEditorStore.setState({
    ...emptyEditorData(),
    history: [],
    historyIndex: -1,
  })
  createdUrls.length = 0
  ;(URL as any).createObjectURL = () => {
    const url = 'blob:export-' + createdUrls.length
    createdUrls.push(url)
    return url
  }
  ;(URL as any).revokeObjectURL = () => {}
})

afterEach(() => {
  document.body.innerHTML = ''
  delete (URL as any).createObjectURL
  delete (URL as any).revokeObjectURL
})

const rootNode: Node = {
  id: 'root-1',
  type: 'page',
  parentId: null,
  children: [],
  styles: {},
  hidden: {},
  locked: false,
  title: 'Home',
  slug: 'home',
  backgroundLayers: [],
}

const h1Node: Node = {
  id: 'h1-1',
  type: 'heading',
  level: 1,
  text: 'Hello Acme',
  parentId: 'root-1',
  children: [],
  styles: { fontFamily: { desktop: 'Inter' } },
  hidden: {},
  locked: false,
}

function setProject(pages: Page[], nodes: Record<string, Node>, projectName = 'Acme') {
  useEditorStore.setState({
    ...emptyEditorData(),
    projectName,
    projectId: 'proj-1',
    pages,
    nodes,
    history: [],
    historyIndex: -1,
  })
}

function renderDialog() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let root!: ReturnType<typeof createRoot>
  act(() => {
    root = createRoot(container)
    root.render(<ExportDialog open onClose={() => {}} />)
  })
  return container
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function downloadButton(container: HTMLElement, label: string) {
  const el = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label)
  if (!el) throw new Error('no download button: ' + label)
  return el as HTMLButtonElement
}

describe('Export dialog', () => {
  it('shows the errors block and disables both downloads when the project has problems', () => {
    setProject([{ id: 'p1', title: '', slug: 'home', rootId: 'root-1' }], { 'root-1': rootNode })
    const container = renderDialog()

    expect(container.textContent).toContain('Errors (1)')
    expect(container.textContent).toContain('Page "home" has no title.')
    expect(container.textContent).not.toContain('No problems found')
    expect(downloadButton(container, 'Download site (.zip)').disabled).toBe(true)
    expect(downloadButton(container, 'Download editable (.roux.zip)').disabled).toBe(true)
    expect(container.textContent).toContain('Fix the errors above before exporting.')
  })

  it('shows warnings but keeps downloads enabled when there are no errors', () => {
    setProject([{ id: 'p1', title: 'Home', slug: 'home', rootId: 'root-1' }], { 'root-1': rootNode })
    const container = renderDialog()

    expect(container.textContent).toContain('Warnings (2)')
    expect(container.textContent).not.toContain('No problems found')
    expect(downloadButton(container, 'Download site (.zip)').disabled).toBe(false)
    expect(downloadButton(container, 'Download editable (.roux.zip)').disabled).toBe(false)
  })

  it('shows "No problems found" on a clean fixture', () => {
    setProject(
      [
        {
          id: 'p1',
          title: 'Home',
          slug: 'home',
          rootId: 'root-1',
          metaDescription: 'A finely tuned site for Acme, built in-house and published on our own domain.',
        },
      ],
      { 'root-1': { ...rootNode, children: ['h1-1'] }, 'h1-1': h1Node },
    )
    const container = renderDialog()

    expect(container.textContent).toContain('No problems found — ready to export.')
    expect(container.textContent).not.toContain('Errors')
    expect(container.textContent).not.toContain('Warnings')
    expect(downloadButton(container, 'Download site (.zip)').disabled).toBe(false)
    expect(downloadButton(container, 'Download editable (.roux.zip)').disabled).toBe(false)
  })

  it('triggers a Blob download when Download site (.zip) is clicked', async () => {
    setProject(
      [
        {
          id: 'p1',
          title: 'Home',
          slug: 'home',
          rootId: 'root-1',
          metaDescription: 'A finely tuned site for Acme, built in-house and published on our own domain.',
        },
      ],
      { 'root-1': { ...rootNode, children: ['h1-1'] }, 'h1-1': h1Node },
    )
    const zipSpy = vi
      .spyOn(zipExportModule, 'zipExport')
      .mockResolvedValue(new Blob(['fake zip']))
    const container = renderDialog()

    await act(async () => {
      downloadButton(container, 'Download site (.zip)').click()
    })
    await flush()

    expect(zipSpy).toHaveBeenCalledTimes(1)
    expect(createdUrls.length).toBeGreaterThan(0)
  })

  it('sends the base URL into the export', async () => {
    setProject(
      [
        {
          id: 'p1',
          title: 'Home',
          slug: 'home',
          rootId: 'root-1',
          metaDescription: 'A finely tuned site for Acme, built in-house and published on our own domain.',
        },
      ],
      { 'root-1': { ...rootNode, children: ['h1-1'] }, 'h1-1': h1Node },
    )
    const zipSpy = vi
      .spyOn(zipExportModule, 'zipExport')
      .mockResolvedValue(new Blob(['fake zip']))
    const container = renderDialog()

    const input = container.querySelector(
      'input[placeholder="https://example.com"]',
    ) as HTMLInputElement
    act(() => {
      input.value = 'https://example.com'
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    })

    await act(async () => {
      downloadButton(container, 'Download site (.zip)').click()
    })

    expect(zipSpy).toHaveBeenCalledTimes(1)
    expect(zipSpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ baseUrl: 'https://example.com' }),
    )
  })
})
