// Roux Studio — right-click context menu.
//
// Mirrors the keyboard shortcuts: Delete, Cut, Copy, Paste, Duplicate, Undo,
// Redo. Paste is gated by the store's containment rules, so a node can never be
// pasted where it isn't allowed to be contained.
import { useCallback } from 'react';
import { ClipboardPaste, Copy, CopyPlus, Redo2, Scissors, Trash2, Undo2 } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
}

type MenuAction =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'duplicate'
  | 'delete';

const ITEMS: {
  id: MenuAction;
  label: string;
  icon: React.ElementType;
  shortcut: string;
}[] = [
  { id: 'undo', label: 'Undo', icon: Undo2, shortcut: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', icon: Redo2, shortcut: 'Ctrl+Shift+Z' },
  { id: 'cut', label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X' },
  { id: 'copy', label: 'Copy', icon: Copy, shortcut: 'Ctrl+C' },
  { id: 'paste', label: 'Paste', icon: ClipboardPaste, shortcut: 'Ctrl+V' },
  { id: 'duplicate', label: 'Duplicate', icon: CopyPlus, shortcut: 'Ctrl+D' },
  { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Delete' },
];

export default function ContextMenu({
  open,
  x,
  y,
  onClose,
}: ContextMenuProps) {
  const selection = useEditorStore((state) => state.selection);
  const nodes = useEditorStore((state) => state.nodes);
  const clipboard = useEditorStore((state) => state.clipboard);
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const setSelection = useEditorStore((state) => state.setSelection);
  const removeNodes = useEditorStore((state) => state.removeNodes);
  const copy = useEditorStore((state) => state.copy);
  const cut = useEditorStore((state) => state.cut);
  const paste = useEditorStore((state) => state.paste);
  const duplicate = useEditorStore((state) => state.duplicate);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  const hasSelection = selection.length > 0;
  const canPaste = !!clipboard?.roots.length;

  const handleAction = useCallback(
    (action: MenuAction) => {
      try {
        switch (action) {
          case 'undo':
            undo();
            break;
          case 'redo':
            redo();
            break;
          case 'cut':
            cut(selection);
            setSelection([]);
            break;
          case 'copy':
            copy(selection);
            break;
          case 'paste':
            paste(selection.length > 0 ? nodes[selection[0]!]?.parentId ?? null : null);
            break;
          case 'duplicate':
            duplicate(selection);
            break;
          case 'delete':
            removeNodes(selection);
            setSelection([]);
            break;
        }
      } catch {
        // Containment rejected or nothing to do — leave the store untouched.
      }
      onClose();
    },
    [
      selection,
      undo, redo, cut, copy, paste, duplicate, removeNodes, setSelection,
    ],
  );

  if (!open) return null;

  // Clamp the menu into the viewport.
  const clampX = Math.min(x, window.innerWidth - 160);
  const clampY = Math.min(y, window.innerHeight - 260);

  return (
    <div
      className="fixed z-[60] bg-slate-900 border border-slate-700 rounded-md shadow-xl p-1 min-w-[170px] text-sm text-slate-200"
      style={{ left: clampX, top: clampY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-col">
        {ITEMS.map((item) => {
          const disabled =
            (item.id === 'undo' && !canUndo()) ||
            (item.id === 'redo' && !canRedo()) ||
            ((item.id === 'cut' || item.id === 'copy' || item.id === 'duplicate' || item.id === 'delete') &&
              !hasSelection) ||
            (item.id === 'paste' && !canPaste);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleAction(item.id)}
              disabled={disabled}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left rounded-md transition text-sm ${
                disabled
                  ? 'text-slate-500'
                  : 'hover:bg-slate-800 text-slate-100'
              }`}
            >
              <Icon size={14} strokeWidth={2} className="shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              <span className="shrink-0 text-xs text-slate-600">{item.shortcut}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
