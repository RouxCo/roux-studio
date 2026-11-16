// Roux Studio — layers tree.
//
// Renders the current page's node tree (from useEditorStore) as a collapsible
// layers list in the left panel. Clicking a row selects the node; selection is
// shared with the canvas so the same node is highlighted in both places.
import { useState, type ReactElement } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import type { Node, NodeId } from '../types';

const TYPE_LABEL: Record<string, string> = {
  page: 'Page',
  section: 'Section',
  container: 'Container',
  box: 'Box',
  heading: 'Heading',
  paragraph: 'Paragraph',
  richText: 'Rich text',
  button: 'Button',
  link: 'Link',
  image: 'Image',
  icon: 'Icon',
  form: 'Form',
  formField: 'Form field',
  faq: 'FAQ',
  faqItem: 'FAQ item',
  slider: 'Slider',
  slide: 'Slide',
  gallery: 'Gallery',
  imageItem: 'Image item',
  pricingTable: 'Pricing table',
  card: 'Card',
  nav: 'Nav',
  footer: 'Footer',
  componentInstance: 'Component',
};

function nodeLabel(node: Node): string {
  if (node.type === 'heading' || node.type === 'paragraph' || node.type === 'button' || node.type === 'link') {
    return (node.text || TYPE_LABEL[node.type]) ?? node.type;
  }
  if (node.type === 'page') return node.title ?? TYPE_LABEL.page;
  return TYPE_LABEL[node.type] ?? node.type;
}

export default function LayersTree() {
  const nodes = useEditorStore((state) => state.nodes);
  const currentPageId = useEditorStore((state) => state.currentPageId);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const [collapsed, setCollapsed] = useState<Set<NodeId>>(new Set());

  const root = currentPageId && nodes[currentPageId] ? nodes[currentPageId] : undefined;

  const toggle = (id: NodeId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const select = (id: NodeId) => {
    setSelection([id]);
  };

  const renderRow = (node: Node, depth: number) => {
    const isSelected = selection.includes(node.id);
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    const label = nodeLabel(node);

    return (
      <div
        key={node.id}
        className={`group relative flex items-center gap-2 px-2 py-1.5 text-sm rounded-md border-transparent ${
          isSelected
            ? 'bg-slate-700 text-slate-100'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`}
        style={{ paddingLeft: 18 + depth * 16 }}
        onClick={(e) => {
          e.stopPropagation();
          select(node.id);
        }}
        title={node.id}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggle(node.id);
            }}
            className="flex w-5 h-5 shrink-0 items-center justify-center rounded bg-slate-800 text-slate-500 hover:text-slate-300 disabled:opacity-50 disabled:pointer-events-none"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <ChevronRight size={12} strokeWidth={2} />
            ) : (
              <ChevronDown size={12} strokeWidth={2} />
            )}
          </button>
        ) : (
          <div className="w-5 h-5 shrink-0" />
        )}
        <Layers className="w-4 h-4 shrink-0 opacity-50 group-hover:opacity-75" aria-hidden="true" />
        <span className="truncate">{label}</span>
        <span className="ml-auto text-[10px] font-mono text-slate-600 truncate max-w-[120px]">{node.id}</span>
      </div>
    );
  };

  if (!root) {
    return (
      <div className="px-4 py-2 text-xs text-slate-500 italic">No page selected</div>
    );
  }

  const renderTree = (node: Node): ReactElement[] => [
    renderRow(node, 0),
    ...(!collapsed.has(node.id)
      ? node.children.flatMap((id) => {
          const child = nodes[id];
          return child ? renderTree(child) : [];
        })
      : []),
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Layers</div>
      <div className="flex-1 overflow-y-auto">{renderTree(root)}</div>
    </div>
  );
}
