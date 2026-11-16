import './index.css'
import { useEffect } from 'react'
import type { Node, NodeId } from './types'
import Canvas from './canvas/Canvas'
import Inspector from './components/Inspector'
import LayersTree from './components/LayersTree'
import TopBar from './components/TopBar'
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

  // Seed the store with the built-in page so the layers tree (and canvas) share
  // one source of truth. Runs once on mount.
  useEffect(() => {
    useEditorStore.setState({
      pages: [{ id: 'page-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
      nodes: NODES,
      currentPageId: 'page-1',
    })
  }, [])

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top bar — breakpoint, zoom, undo/redo */}
      <TopBar />

      {/* Left panel — layers tree */}
      <aside className={`fixed top-[${TOP_BAR_HEIGHT}px] bottom-0 left-0 z-30 w-[${SIDE_PANEL_WIDTH}px] border-r border-slate-800 bg-slate-900 text-slate-400`}>
        <LayersTree />
      </aside>

      {/* Centre canvas — fills the remaining space, centred and scrollable */}
      <main className={`fixed top-[${TOP_BAR_HEIGHT}px] bottom-0 left-[${SIDE_PANEL_WIDTH}px] right-[${SIDE_PANEL_WIDTH}px] z-10 overflow-auto relative bg-slate-950`}>
        <div className="flex h-full w-full items-center justify-center p-6">
          <Canvas page={NODES['page-1']!} nodes={NODES} breakpoint={breakpoint} zoom={zoom} />
        </div>
      </main>

      {/* Right panel — Inspector: layout, typography, colors, spacing */}
      <aside className={`fixed top-[${TOP_BAR_HEIGHT}px] bottom-0 right-0 z-30 w-[${SIDE_PANEL_WIDTH}px] border-l border-slate-800 bg-slate-900 text-slate-400 flex flex-col`}>
        <Inspector />
      </aside>
    </div>
  )
}
