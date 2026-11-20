// Roux Studio — top bar.
//
// Breakpoint toggles (Desktop 1440 / Tablet 768 / Mobile 390), a zoom control
// and undo/redo buttons, all wired to useEditorStore. UI state (breakpoint,
// zoom) is not history-tracked, so toggling them never creates undo steps.
import { useCallback } from 'react';
import type { ElementType } from 'react';
import {
  Plus,
  Download,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone,
  Tablet,
  Play,
  Pause,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import type { Breakpoint } from '../types';

const BREAKPOINTS: {
  id: Breakpoint;
  label: string;
  width: number;
  icon: ElementType;
}[] = [
  { id: 'desktop', label: 'Desktop', width: 1440, icon: Monitor },
  { id: 'tablet', label: 'Tablet', width: 768, icon: Tablet },
  { id: 'mobile', label: 'Mobile', width: 390, icon: Smartphone },
];

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export default function TopBar({
  onNewProject,
  onExport,
  onInsert,
}: { onNewProject?: () => void; onExport?: () => void; onInsert?: () => void }) {
  const breakpoint = useEditorStore((state) => state.breakpoint);
  const setBreakpoint = useEditorStore((state) => state.setBreakpoint);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.canUndo());
  const canRedo = useEditorStore((state) => state.canRedo());
  const playBackgrounds = useEditorStore((state) => state.playBackgrounds);
  const setPlayBackgrounds = useEditorStore((state) => state.setPlayBackgrounds);

  const handleZoomChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setZoom(Number(event.target.value));
    },
    [setZoom],
  );

  const zoomOut = () => setZoom(Math.max(0.25, zoom - 0.25));
  const zoomIn = () => setZoom(Math.min(4, zoom + 0.25));

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-[56px] border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between px-6 text-slate-200">
      <div className="flex items-center gap-3">
        <span className="font-semibold tracking-tight">Roux Studio</span>
        <span className="text-xs text-slate-500">Editor</span>
        {onNewProject && (
          <button
            onClick={onNewProject}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-slate-100"
          >
            <Plus size={14} strokeWidth={2} />
            New project
          </button>
        )}
        {onInsert && (
          <button
            onClick={onInsert}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-slate-100"
            title="Insert element"
            aria-label="Insert element"
          >
            <Plus size={14} strokeWidth={2} />
            Insert
          </button>
        )}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-slate-100"
          >
            <Download size={14} strokeWidth={2} />
            Export
          </button>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Breakpoint toggles — active one highlighted */}
        <div className="flex items-center gap-1">
          {BREAKPOINTS.map((bp) => {
            const active = breakpoint === bp.id;
            const Icon = bp.icon;
            return (
              <button
                key={bp.id}
                onClick={() => setBreakpoint(bp.id)}
                aria-pressed={active}
                title={`${bp.label} (${bp.width}px)`}
                className={`flex w-8 h-8 shrink-0 items-center justify-center rounded-md transition ${
                  active
                    ? 'bg-slate-700 text-slate-100 shadow-sm'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon size={13} strokeWidth={2} />
              </button>
            );
          })}
        </div>

        {/* Zoom control: stepper buttons plus a select of preset levels */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={zoom <= 0.25}
            className="w-7 h-7 shrink-0 rounded-md bg-slate-800/50 text-slate-400 flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none hover:!bg-slate-800"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minimize2 size={12} strokeWidth={2} />
          </button>
          <select
            value={String(zoom)}
            onChange={handleZoomChange}
            className="w-16 shrink-0 rounded-md border border-slate-700 bg-slate-800/50 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
          >
            {ZOOM_LEVELS.map((level) => (
              <option key={level} value={String(level)}>
                {(level * 100).toFixed(0)}%
              </option>
            ))}
          </select>
          <button
            onClick={zoomIn}
            disabled={zoom >= 4}
            className="w-7 h-7 shrink-0 rounded-md bg-slate-800/50 text-slate-400 flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none hover:!bg-slate-800"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Maximize2 size={12} strokeWidth={2} />
          </button>
        </div>

        {/* Undo / Redo — disabled when nothing to undo or redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="w-8 h-8 shrink-0 rounded-md bg-slate-800/50 text-slate-400 flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none hover:!bg-slate-700 disabled:hover:!bg-slate-800/50"
            title="Undo"
            aria-label="Undo"
          >
            <Undo2 size={13} strokeWidth={2} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="w-8 h-8 shrink-0 rounded-md bg-slate-800/50 text-slate-400 flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none hover:!bg-slate-700 disabled:hover:!bg-slate-800/50"
            title="Redo"
            aria-label="Redo"
          >
            <Redo2 size={13} strokeWidth={2} />
          </button>
          {/* Play backgrounds — preview video layers on the canvas */}
          <button
            onClick={() => setPlayBackgrounds(!playBackgrounds)}
            aria-pressed={playBackgrounds}
            title="Play backgrounds"
            className={`w-8 h-8 shrink-0 rounded-md flex items-center justify-center ${
              playBackgrounds
                ? 'bg-slate-700 text-slate-100'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {playBackgrounds ? <Pause size={13} strokeWidth={2} /> : <Play size={13} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </header>
  );
}
