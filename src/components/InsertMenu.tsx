// Roux Studio — insert menu.
//
// A dropdown of element types that can be added to the canvas. Clicking an item
// inserts a fresh node of that type into the selected node (if containment allows
// it), its parent, or the page root, then selects the new node so it can be moved
// and styled straight away. Closes on insert.
import { useCallback } from 'react';
import {
  AlignLeft,
  Box,
  Circle,
  Image,
  Layout,
  Link,
  PanelLeft,
  Square,
  Text,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import type { ElementType } from '../types';

type InsertItem = {
  type: ElementType;
  label: string;
  Icon: React.ElementType;
};

const ITEMS: InsertItem[] = [
  { type: 'section', label: 'Section', Icon: Layout },
  { type: 'container', label: 'Container', Icon: PanelLeft },
  { type: 'box', label: 'Box', Icon: Box },
  { type: 'heading', label: 'Heading', Icon: Text },
  { type: 'paragraph', label: 'Paragraph', Icon: AlignLeft },
  { type: 'button', label: 'Button', Icon: Square },
  { type: 'link', label: 'Link', Icon: Link },
  { type: 'image', label: 'Image', Icon: Image },
  { type: 'icon', label: 'Icon', Icon: Circle },
];

interface InsertMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function InsertMenu({ open, onClose }: InsertMenuProps) {
  const insertElement = useEditorStore((state) => state.insertElement);

  const handleInsert = useCallback(
    (type: ElementType) => {
      insertElement(type);
      onClose();
    },
    [insertElement, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed top-[56px] left-0 z-[50] w-64 bg-slate-900 border border-slate-700 rounded-md shadow-2xl p-1 text-sm text-slate-200"
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        Insert
      </div>
      <div className="grid grid-cols-3 gap-1">
        {ITEMS.map((item) => {
          const Icon = item.Icon;
          return (
            <button
              key={item.type}
              onClick={() => handleInsert(item.type)}
              className="flex flex-col items-center gap-1 px-2 py-2 rounded-md transition text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              title={item.label}
            >
              <Icon size={16} strokeWidth={2} className="shrink-0" />
              <span className="text-[10px] leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
