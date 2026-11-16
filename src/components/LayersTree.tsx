// Roux Studio — layers tree with @dnd-kit drag and drop.
//
// Renders the current page's node tree (from useEditorStore) as a collapsible
// layers list in the left panel. Rows are draggable: drop a row on a sibling to
// reorder among siblings, or on a container-like node to move it into a
// different parent. Moves are committed through the store's moveNode (one undo
// step per move) and are gated by the existing containment rules, so an illegal
// nest is rejected and the store is left untouched. Selection stays synced
// because it is stored by node id and the moved node keeps its id.
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { assertCanContain } from '../store/containment';
import type { ElementType, Node, NodeId } from '../types';

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
  if (
    node.type === 'heading' ||
    node.type === 'paragraph' ||
    node.type === 'button' ||
    node.type === 'link'
  ) {
    return (node.text || TYPE_LABEL[node.type]) ?? node.type;
  }
  if (node.type === 'page') return node.title ?? TYPE_LABEL.page;
  return TYPE_LABEL[node.type] ?? node.type;
}

function canContain(parentType: ElementType | 'root', childType: ElementType): boolean {
  try {
    assertCanContain(parentType, childType);
    return true;
  } catch {
    return false;
  }
}

function Row({
  node,
  depth,
  collapsed,
  setCollapsed,
}: {
  node: Node;
  depth: number;
  collapsed: Set<NodeId>;
  setCollapsed: (next: Set<NodeId>) => void;
}) {
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);

  const isSelected = selection.includes(node.id);
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;
  const label = nodeLabel(node);

  // Pages stay at the root and cannot be moved, so they are not draggable.
  const { attributes, listeners, node: setDraggableRef, transform, isDragging } =
    useDraggable({ id: node.id, disabled: node.type === 'page' });
  const { isOver, node: setDroppableRef } = useDroppable({ id: node.id });

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      setDraggableRef.current = el;
      setDroppableRef.current = el;
    },
    [setDraggableRef, setDroppableRef],
  );

  const toggle = () => {
    if (isCollapsed) {
      setCollapsed(new Set([...collapsed].filter((id) => id !== node.id)));
    } else {
      const next = new Set(collapsed);
      next.add(node.id);
      setCollapsed(next);
    }
  };

  const select = () => {
    setSelection([node.id]);
  };

  const selectedCls = isSelected ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200';
  const targetCls = isOver ? 'bg-slate-700/60' : '';
  const dragCls = isDragging ? 'opacity-0' : '';

  return (
    <div
      ref={setRef}
      {...attributes}
      {...listeners}
      key={node.id}
      className={`group relative flex items-center gap-2 px-2 py-1.5 text-sm rounded-md border-transparent ${selectedCls} ${targetCls} ${dragCls}`}
      style={{
        paddingLeft: 18 + depth * 16,
        ...(transform
          ? {
              transform: `translate3d(${transform.x}px,${transform.y}px,0) scale(${transform.scaleX},${transform.scaleY})`,
            }
          : {}),
      }}
      onClick={(e) => {
        e.stopPropagation();
        select();
      }}
      title={node.id}
    >
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle();
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
}

export default function LayersTree() {
  const nodes = useEditorStore((state) => state.nodes);
  const currentPageId = useEditorStore((state) => state.currentPageId);
  const moveNode = useEditorStore((state) => state.moveNode);
  const [collapsed, setCollapsed] = useState<Set<NodeId>>(new Set());

  const pointerSensor = useMemo(
    () => ({
      sensor: PointerSensor,
      options: { activationConstraint: { distance: 8 } },
    }),
    [],
  );
  const sensors = useSensors(pointerSensor);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const draggedId = active.id as NodeId;
      const targetId = over ? (over.id as NodeId) : null;
      if (!targetId || targetId === draggedId) return;
      const dragged = nodes[draggedId];
      const target = nodes[targetId];
      if (!dragged || !target) return;

      let parentId: NodeId | null = dragged.parentId;
      let index: number | undefined;

      if (target.parentId === dragged.parentId) {
        // Reorder among siblings: insert dragged right before target.
        const children = nodes[dragged.parentId ?? '']?.children ?? [];
        const ti = children.indexOf(targetId);
        const di = children.indexOf(draggedId);
        if (ti < 0 || di < 0) return;
        index = ti > di ? ti - 1 : ti;
      } else if (canContain(target.type, dragged.type)) {
        // Move into a different parent: append as the target's last child.
        parentId = targetId;
        index = undefined;
      } else {
        return;
      }

      try {
        moveNode(draggedId, parentId, index);
      } catch {
        // Containment rejected — drop cancels, store is left untouched.
      }
    },
    [nodes, moveNode],
  );

  const root = currentPageId && nodes[currentPageId] ? nodes[currentPageId] : undefined;

  const renderTree = (node: Node): ReactElement[] => [
    <Row key={node.id} node={node} depth={0} collapsed={collapsed} setCollapsed={setCollapsed} />,
    ...(!collapsed.has(node.id)
      ? node.children.flatMap((id) => {
          const child = nodes[id];
          return child ? renderTree(child) : [];
        })
      : []),
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Layers</div>
        <div className="flex-1 overflow-y-auto">
          {!root ? (
            <div className="px-4 py-2 text-xs text-slate-500 italic">No page selected</div>
          ) : (
            renderTree(root)
          )}
        </div>
      </div>
      <DragOverlay />
    </DndContext>
  );
}
