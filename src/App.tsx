import './index.css'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import Canvas from './canvas/Canvas'
import Inspector from './components/Inspector'
import TopBar from './components/TopBar'
import NewProjectDialog from './components/NewProjectDialog'
// Lazy-loaded: the export pipeline (compile, render, jszip) ships in its own
// chunk instead of bloating the main index chunk.
const ExportDialog = lazy(() => import('./components/ExportDialog'))
import ContextMenu from './components/ContextMenu'
import { useEditorStore } from './store/useEditorStore'
import { loadProject, listAllProjects } from './db/crud'

const TOP_BAR_HEIGHT = 56
const SIDE_PANEL_WIDTH = 280

// Left panels are lazy-loaded so each one ships in its own chunk instead of
// the main bundle. None is used outside App.tsx.
const LayersTree = lazy(() => import('./components/LayersTree'))
const PagesPanel = lazy(() => import('./components/PagesPanel'))
const SeoPanel = lazy(() => import('./components/SeoPanel'))
const TokensPanel = lazy(() => import('./components/TokensPanel'))
const BlocksPanel = lazy(() => import('./components/BlocksPanel'))

export default function App() {
  const breakpoint = useEditorStore((state) => state.breakpoint)
  const zoom = useEditorStore((state) => state.zoom)
  const canUndo = useEditorStore((state) => state.canUndo)
  const canRedo = useEditorStore((state) => state.canRedo)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)

  const pages = useEditorStore((state) => state.pages)
  const nodes = useEditorStore((state) => state.nodes)
  const currentPageId = useEditorStore((state) => state.currentPageId)

  const page = pages.find((p) => p.id === currentPageId) ?? pages[0]
  const pageNode = page ? nodes[page.rootId] : undefined

  const [menu, setMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0,
  })

  // Left panel tabs: Layers, Pages, SEO, Tokens or Blocks. Defaults to Layers.
  const [tab, setTab] = useState<'layers' | 'pages' | 'seo' | 'tokens' | 'blocks'>('layers')

  const [newOpen, setNewOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const set = useEditorStore.setState

  // Open the most recently saved project on mount. A missing or unreachable
  // IndexedDB must not stop the editor opening, so a rejected lookup is ignored.
  useEffect(() => {
    ;(async () => {
      try {
        const list = await listAllProjects()
        const first = list[0]
        if (first) {
          await loadProject(set, first.id)
        }
      } catch {
        // Ignore — the editor opens with an empty store.
      }
    })()
  }, [])

  // Global keyboard shortcuts: Del, Ctrl/Cmd + Z / Shift+Z / C / V / D / X.
  // Ignored while the user is typing into an input, textarea or contentEditable.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return
      }
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl && e.key !== 'Delete' && e.key !== 'Backspace') return
      e.preventDefault()

      const state = useEditorStore.getState()
      const sel = state.selection
      const pasteTarget =
        sel.length > 0 ? (state.nodes[sel[0]!]?.parentId ?? null) : null

      switch (e.key) {
        case 'z':
          if (e.shiftKey) { if (canRedo()) redo() }
          else { if (canUndo()) undo() }
          break
        case 'c':
          state.copy(sel)
          break
        case 'x':
          state.cut(sel)
          setMenu({ open: false, x: 0, y: 0 })
          break
        case 'v':
          state.paste(pasteTarget)
          break
        case 'd':
          state.duplicate(sel)
          break
        case 'Delete':
        case 'Backspace':
          state.removeNodes(sel)
          break
      }
    },
    [canUndo, canRedo, undo, redo],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const openMenu = useCallback((x: number, y: number) => {
    setMenu({ open: true, x, y })
  }, [])

  const closeMenu = useCallback(() => setMenu((m) => (m.open ? { ...m, open: false } : m)), [])

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-100"
      onContextMenu={(e) => {
        e.preventDefault()
        openMenu(e.clientX, e.clientY)
      }}
    >
      {/* Top bar — breakpoint, zoom, undo/redo */}
      <TopBar
        onNewProject={() => setNewOpen(true)}
        onExport={() => setExportOpen(true)}
      />

      {/* Left panel — layers / tokens tabs */}
      <aside className={`fixed top-[${TOP_BAR_HEIGHT}px] bottom-0 left-0 z-30 w-[${SIDE_PANEL_WIDTH}px] border-r border-slate-800 bg-slate-900 text-slate-400`}>
        <div className="flex-shrink-0 px-4 py-2 border-b border-slate-800">
          <div className="flex gap-1">
            <button
              onClick={() => setTab('layers')}
              className={`px-3 py-1.5 text-xs rounded-t-lg transition ${tab === 'layers' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-200'}`}
            >
              Layers
            </button>
            <button
              onClick={() => setTab('pages')}
              className={`px-3 py-1.5 text-xs rounded-t-lg transition ${tab === 'pages' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-200'}`}
            >
              Pages
            </button>
            <button
              onClick={() => setTab('tokens')}
              className={`px-3 py-1.5 text-xs rounded-t-lg transition ${tab === 'tokens' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-200'}`}
            >
              Tokens
            </button>
            <button
              onClick={() => setTab('seo')}
              className={`px-3 py-1.5 text-xs rounded-t-lg transition ${tab === 'seo' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-200'}`}
            >
              SEO
            </button>
            <button
              onClick={() => setTab('blocks')}
              className={`px-3 py-1.5 text-xs rounded-t-lg transition ${tab === 'blocks' ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-200'}`}
            >
              Blocks
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<div className="h-40 w-[280px] bg-slate-900/40" />}>
            {tab === 'layers' ? (
              <LayersTree onContextMenu={openMenu} />
            ) : tab === 'pages' ? (
              <PagesPanel />
            ) : tab === 'seo' ? (
              <SeoPanel />
            ) : tab === 'tokens' ? (
              <TokensPanel />
            ) : (
              <BlocksPanel />
            )}
          </Suspense>
        </div>
      </aside>

      {/* Centre canvas — fills the remaining space, centred and scrollable */}
      <main className={`fixed top-[${TOP_BAR_HEIGHT}px] bottom-0 left-[${SIDE_PANEL_WIDTH}px] right-[${SIDE_PANEL_WIDTH}px] z-10 overflow-auto relative bg-slate-950`}>
        <div className="flex h-full w-full items-center justify-center p-6">
          {pageNode ? (
            <Canvas
              page={pageNode}
              nodes={nodes}
              breakpoint={breakpoint}
              zoom={zoom}
              onContextMenu={openMenu}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400">
              <h2 className="text-sm font-semibold">No pages yet</h2>
              <p className="text-xs text-slate-500">
                Create a new project to start designing.
              </p>
              <button
                onClick={() => setNewOpen(true)}
                className="mt-4 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                New project
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Right panel — Inspector: layout, typography, colors, spacing */}
      <aside className={`fixed top-[${TOP_BAR_HEIGHT}px] bottom-0 right-0 z-30 w-[${SIDE_PANEL_WIDTH}px] border-l border-slate-800 bg-slate-900 text-slate-400 flex flex-col`}>
        <Inspector />
      </aside>

      {menu.open && (
        <ContextMenu
          open={true}
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
        />
      )}

      <NewProjectDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => setNewOpen(false)}
      />
      <Suspense fallback={<div className="fixed inset-0 z-[55] bg-slate-900/70" />}>
        <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      </Suspense>
    </div>
  )
}
