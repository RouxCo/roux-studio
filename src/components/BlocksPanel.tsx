// Roux Studio — Blocks panel.
//
// Lists saved project blocks. Clicking a block inserts a fresh copy of it into
// the canvas: into the selected node if containment allows it, otherwise after
// the selected node in its parent, otherwise at the page root. Rows can be
// renamed (inline input, save on Enter/blur) and deleted (confirm).
//
// Empty state: "No blocks yet. Right-click a section or container and choose
// Save as block."
import { useState } from 'react';
import { Blocks, Trash2, Edit2 } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { CONTAINMENT_RULES } from '../store/containment';
import type { Block, ElementType, NodeId } from '../types';

const TYPE_LABEL: Record<string, string> = {
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

interface BlockRowProps {
  block: Block;
}

function canContain(parentType: ElementType | 'root', childType: ElementType): boolean {
  const allowed =
    parentType === 'root' ? CONTAINMENT_RULES.page : CONTAINMENT_RULES[parentType];
  return Boolean(allowed?.has(childType));
}

function pickInsertTarget(
  currentPageId: NodeId | null,
  rootType: ElementType,
): NodeId | null {
  const state = useEditorStore.getState();
  const sel = state.selection;
  const selected = sel.length > 0 ? state.nodes[sel[0]!] : undefined;

  if (selected && canContain(selected.type as ElementType, rootType)) {
    return selected.id;
  }
  if (selected && selected.parentId !== null) {
    const parent = state.nodes[selected.parentId];
    const parentType = parent?.type;
    if (parentType && canContain(parentType, rootType)) {
      return selected.parentId;
    }
  }
  if (currentPageId && canContain('root', rootType)) {
    return currentPageId;
  }
  return null;
}

function BlockRow({ block }: BlockRowProps) {
  const nodes = useEditorStore((state) => state.nodes);
  const root = nodes[block.rootId];
  const actualRootType = (root?.type as ElementType) ?? 'section';

  const [renameMode, setRenameMode] = useState(false);
  const [renameValue, setRenameValue] = useState(block.name);
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);

  const currentPageId = useEditorStore((state) => state.currentPageId);
  const insertBlock = useEditorStore((state) => state.insertBlock);
  const renameBlock = useEditorStore((state) => state.renameBlock);
  const deleteBlock = useEditorStore((state) => state.deleteBlock);

  const clearMessage = () => setMessage(null);

  const handleInsert = () => {
    const target = pickInsertTarget(currentPageId, actualRootType);
    if (!target) {
      setMessage({ text: `Can't insert a ${actualRootType} here`, kind: 'error' });
      setTimeout(clearMessage, 3000);
      return;
    }
    try {
      insertBlock(block.id, target);
      setMessage({ text: 'Inserted', kind: 'ok' });
      setTimeout(clearMessage, 3000);
    } catch {
      setMessage({ text: `Can't insert a ${actualRootType} here`, kind: 'error' });
      setTimeout(clearMessage, 3000);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    else if (e.key === 'Escape') {
      setRenameValue(block.name);
      setRenameMode(false);
    }
  };

  const saveRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== block.name) {
      renameBlock(block.id, trimmed);
    }
    setRenameMode(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete block "${block.name}"?`)) {
      deleteBlock(block.id);
    }
  };

  const thumbColor =
    actualRootType === 'section'
      ? 'bg-gradient-to-br from-slate-700 to-slate-900'
      : 'bg-gradient-to-br from-slate-800 to-slate-950';

  return (
    <div
      className="group flex items-start gap-2 px-3 py-2.5 rounded-lg border border-transparent hover:border-slate-700 hover:bg-slate-800 transition cursor-default"
      onClick={handleInsert}
    >
      <div className="flex-shrink-0 w-12 h-12 rounded border border-slate-700 bg-slate-900 flex items-center justify-center overflow-hidden relative shrink-0">
        <div className={`absolute inset-0 ${thumbColor} opacity-80`} />
        <Blocks className="w-5 h-5 text-slate-300 shrink-0" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {renameMode ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={saveRename}
              className="flex-1 text-xs text-slate-100 bg-transparent border-b border-slate-600 focus:border-cyan-500 focus:outline-none px-1"
            />
          ) : (
            <>
              <span className="flex-1 truncate text-sm font-medium text-slate-200">
                {block.name}
              </span>
              <button
                onClick={() => {
                  setRenameValue(block.name);
                  setRenameMode(true);
                }}
                className="w-6 h-6 shrink-0 rounded-md border border-slate-700 bg-slate-900 text-slate-400 flex items-center justify-center text-[10px] hover:bg-slate-800 hover:text-slate-200"
                aria-label="Rename"
              >
                <Edit2 size={12} strokeWidth={2} />
              </button>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="w-6 h-6 shrink-0 rounded-md border border-slate-700 bg-slate-900 text-slate-400 flex items-center justify-center text-[10px] hover:bg-slate-800 hover:text-red-400 hover:border-red-500"
            aria-label="Delete"
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </div>
        <span className="text-[10px] text-slate-500">
          {TYPE_LABEL[actualRootType] ?? actualRootType}
        </span>
        {message && (
          <p
            className="mt-1 text-[11px] leading-snug"
            style={{ color: message.kind === 'error' ? '#f87171' : '#86efac' }}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

interface BlocksPanelProps {
  open?: boolean;
}

export default function BlocksPanel({ open = true }: BlocksPanelProps) {
  const blocks = useEditorStore((state) => state.blocks);

  if (!open) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800">
        Blocks
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Blocks className="w-10 h-10 text-slate-600 mb-2" />
            <p className="text-sm text-slate-400 max-w-xs text-center">
              No blocks yet. Right-click a section or container and choose
              <br />
              <span className="font-medium text-slate-300">Save as block.</span>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.map((block) => (
              <BlockRow key={block.id} block={block} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
