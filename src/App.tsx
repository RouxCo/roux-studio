import './index.css'
import { useCallback, useEffect, useState } from 'react'
import type { Node, NodeId } from './types'
import Canvas from './canvas/Canvas'
import Inspector from './components/Inspector'
import LayersTree from './components/LayersTree'
import TopBar from './components/TopBar'
import ContextMenu from './components/ContextMenu'
import { useEditorStore } from './store/useEditorStore'

const NODES: Record<NodeId, Node> = {
  'page-1': {
    id: 'page-1', type: 'page', parentId: null, children: ['sec-1'], styles: {}, hidden: {}, locked: false,
    title: 'Home', slug: 'home', backgroundLayers: [],
  },
  'sec-1': {
    id: 'sec-1', type: 'section', parentId: 'page-1', children: ['box-1'], styles: {
      width: { desktop: { kind: 'px', value: 1440 }, tablet: { kind: 'px', value: 768 }, mobile: { kind: 'px', value: 390 } },
    }, hidden: {}, locked: false, backgroundLayers: [], sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  },
  'box-1': {
    id: 'box-1', type: 'box', parentId: 'sec-1', children: ['h-1', 'p-1'], styles: {
      display: { desktop: 'flex' }, padding: { desktop: { kind: 'px', value: 24 } },
    }, hidden: {}, locked: false,
  },
  'h-1': {
    id: 'h-1', type: 'heading', parentId: 'box-1', children: [], styles: { color: { desktop: '#0f766e' } },
    hidden: {}, locked: false, level: 1, text: 'Roux and Co.',
  },
  'p-1': {
    id: 'p-1', type: 'paragraph', parentId: 'box-1', children: [], styles: { fontSize: { desktop: { kind: 'px', value: 16 } } },
    hidden: {}, locked: false, text: 'We build websites that work.',
  },
}

const TOP_BAR_HEIGHT = 56
const SIDE_PANEL_WIDTH = 280

export default function App() {
  const breakpoint = useEditorStore((state) => state.breakpoint)
  const zoom = useEditorStore((state) => state.zoom)
  const canUndo = useEditorStore((state) => state.canUndo)
  const canRedo = useEditorStore((state) => state.canRedo)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)

  const [menu, setMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0,
  })

  // Seed the store with the built-in page so the layers tree (and canvas) share
  // one source of truth. Runs once on mount.
  useEffect(() => {
    useEditorStore.setState({
      pages: [{ id: 'page-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
      nodes: NODES,
      currentPageId: 'page-1',
    })
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
      <TopBar />

      {/* Left panel — layers tree */}
      <aside className={`fixed top-[${TOP_BAR_HEIGHT}px] bottom-0 left-0 z-30 w-[${SIDE_PANEL_WIDTH}px] border-r border-slate-800 bg-slate-900 text-slate-400`}>
        <LayersTree onContextMenu={openMenu} />
      </aside>

      {/* Centre canvas — fills the remaining space, centred and scrollable */}
      <main className={`fixed top-[${TOP_BAR_HEIGHT}px] bottom-0 left-[${SIDE_PANEL_WIDTH}px] right-[${SIDE_PANEL_WIDTH}px] z-10 overflow-auto relative bg-slate-950`}>
        <div className="flex h-full w-full items-center justify-center p-6">
          <Canvas
            page={NODES['page-1']!}
            nodes={NODES}
            breakpoint={breakpoint}
            zoom={zoom}
            onContextMenu={openMenu}
          />
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
    </div>
  )
}
