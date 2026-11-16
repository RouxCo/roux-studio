import './index.css'
import type { Node, NodeId } from './types'
import Canvas from './canvas/Canvas'

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

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <main className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-4">Roux Studio</h1>
        <p className="text-slate-400">Local-first visual website builder</p>
      </main>
      <div style={{ minHeight: 500 }}>
        <Canvas page={NODES['page-1']!} nodes={NODES} breakpoint="desktop" />
      </div>
    </div>
  )
}
