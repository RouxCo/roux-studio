// Roux Studio — pages panel in the left sidebar.
//
// Lists the project's pages: click a row to switch page and the current page is
// highlighted with aria-current="page". A "New page" button adds a blank page
// through the store and makes it current. Rows can be renamed inline (save on
// Enter/blur, Escape cancels) and deleted with the trash button, which is
// disabled while only one page remains — the last page can never be removed
// from the UI.
import { useState } from 'react';
import { Files, Plus, Pencil, Trash2 } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import type { Page, PageId } from '../types';

export default function PagesPanel() {
  const pages = useEditorStore((state) => state.pages);
  const currentPageId = useEditorStore((state) => state.currentPageId);
  const addBlankPage = useEditorStore((state) => state.addBlankPage);
  const removePage = useEditorStore((state) => state.removePage);
  const renamePage = useEditorStore((state) => state.renamePage);
  const setCurrentPageId = useEditorStore((state) => state.setCurrentPageId);

  const [renaming, setRenaming] = useState<PageId | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleNewPage = () => {
    setRenaming(null);
    addBlankPage();
  };

  const selectPage = (id: PageId) => {
    setRenaming(null);
    setCurrentPageId(id);
  };

  const startRename = (id: PageId) => {
    const page = pages.find((p) => p.id === id);
    setRenaming(id);
    setRenameValue(page ? page.title : '');
  };

  const commitRename = (id: PageId, next: string) => {
    const page = pages.find((p) => p.id === id);
    next = next.trim();
    if (!next || !page || next === page.title) {
      setRenaming(null);
      setRenameValue('');
      return;
    }
    renamePage(id, next);
    setRenaming(null);
    setRenameValue('');
  };

  const cancelRename = () => {
    setRenaming(null);
    setRenameValue('');
  };

  const handleDelete = (id: PageId) => {
    if (pages.length <= 1) return;
    removePage(id);
    cancelRename();
  };

  const canDelete = pages.length > 1;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 flex items-center gap-2 border-b border-slate-800">
        <Files size={14} strokeWidth={2} />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Pages</span>
        <button
          onClick={handleNewPage}
          className="ml-auto shrink-0 rounded-md border border-slate-700 bg-slate-800 text-slate-200 flex items-center justify-center text-[10px] hover:bg-slate-700 gap-1 px-2 py-1"
          aria-label="New page"
        >
          <Plus size={12} strokeWidth={2} />
          <span className="text-[10px]">New page</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {pages.length === 0 ? (
          <div className="px-2 text-[10px] text-slate-500 italic">No pages</div>
        ) : (
          <div className="space-y-0.5">
            {pages.map((page) => (
              <PageRow
                key={page.id}
                page={page}
                renameValue={renameValue}
                isCurrent={page.id === currentPageId}
                isRenaming={renaming === page.id}
                onClick={() => selectPage(page.id)}
                onStartRename={() => startRename(page.id)}
                onChangeValue={setRenameValue}
                onCommitRename={(next: string) => commitRename(page.id, next)}
                onCancelRename={cancelRename}
                onDelete={() => handleDelete(page.id)}
                canDelete={canDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PageRowProps {
  page: Page;
  renameValue: string;
  isCurrent: boolean;
  isRenaming: boolean;
  onClick: () => void;
  onStartRename: (id: PageId) => void;
  onChangeValue: (next: string) => void;
  onCommitRename: (next: string) => void;
  onCancelRename: () => void;
  onDelete: (id: PageId) => void;
  canDelete: boolean;
}

function PageRow({
  page,
  isCurrent,
  isRenaming,
  renameValue,
  onClick,
  onStartRename,
  onChangeValue,
  onCommitRename,
  onCancelRename,
  onDelete,
  canDelete,
}: PageRowProps) {
  const [hovered, setHovered] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelRename();
    }
  };

  const rowCls = isCurrent
    ? 'bg-slate-800 text-slate-100'
    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200';

  const actionCls = (kind: 'pencil' | 'trash'): string => {
    const base = 'w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-[10px]';
    if (kind === 'trash' && !canDelete) {
      return `${base} border border-slate-700 bg-slate-900 text-slate-600 opacity-50 pointer-events-none`;
    }
    return hovered
      ? `${base} border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700`
      : `${base} border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200`;
  };

  return (
    <div
      aria-current={isCurrent ? 'page' : undefined}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md border-transparent transition ${rowCls}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isRenaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => onChangeValue(e.target.value)}
          onBlur={(e) => onCommitRename((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          className="flex-1 text-xs text-slate-100 bg-transparent border-b border-slate-600 focus:border-cyan-500 focus:outline-none px-1"
        />
      ) : (
        <span className="flex-1 truncate text-sm" title={page.title}>
          {page.title}
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStartRename(page.id);
        }}
        className={actionCls('pencil')}
        aria-label="Rename page"
        disabled={isRenaming}
      >
        <Pencil size={12} strokeWidth={2} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(page.id);
        }}
        className={actionCls('trash')}
        aria-label="Delete page"
        disabled={!canDelete}
      >
        <Trash2 size={12} strokeWidth={2} />
      </button>
    </div>
  );
}
