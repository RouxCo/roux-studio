// src/components/MultiTabGuard.tsx
// Roux Studio — multi-tab take-over banner.
//
// When another tab saves a newer revision of the open project, the store sets
// readOnly: true (via projectBroadcast.subscribe in useEditorStore). This banner
// surfaces that state and offers "Take over" (claims the revision, clears
// readOnly) or "Reload" (refreshes to pick up the saved state). When nothing is
// pending the component renders nothing.
import { useState } from 'react';
import { useEditorStore } from '../store/useEditorStore';

export default function MultiTabGuard() {
  const readOnly = useEditorStore((state) => state.readOnly);
  const remoteRevision = useEditorStore((state) => state.remoteRevision);
  const takeOver = useEditorStore((state) => state.takeOver);
  const [dismissed, setDismissed] = useState(false);

  if (!readOnly || dismissed) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="pointer-events-auto max-w-md w-full bg-slate-900 border border-slate-700 rounded-md p-4 text-slate-200 shadow-lg"
        role="alert"
      >
        <p className="text-sm mb-3">
          Another tab saved changes to this project (revision {remoteRevision}).
          This tab is read-only until you take over.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              takeOver();
              setDismissed(true);
            }}
            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded border border-slate-600"
          >
            Take over
          </button>
          <button
            onClick={() => {
              window.location.reload();
              setDismissed(true);
            }}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
