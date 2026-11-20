// src/components/ConfirmDialog.tsx
// Roux Studio — reusable confirmation modal.
//
// A destructive action (clean unused assets, delete, ...) should never fire on
// a single click. This dialog states what will happen and requires an explicit
// confirm before calling onConfirm. Renders nothing when closed.
import { AlertTriangle } from 'lucide-react';

const PANEL =
  'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-md p-6 border border-slate-700 bg-slate-900 rounded-xl shadow-2xl text-slate-100';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel = 'Confirm',
  onConfirm,
  confirmVariant = 'primary',
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  const isDanger = confirmVariant === 'danger';
  return (
    <div
      className="fixed inset-0 z-[55] bg-slate-900/70"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={PANEL} onContextMenu={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle
            size={16}
            strokeWidth={2}
            className={`text-${isDanger ? 'rose-400' : 'cyan-400'}`}
          />
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        </div>

        <p className="text-xs text-slate-300 mb-6 leading-relaxed">{body}</p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm text-white disabled:opacity-50 disabled:pointer-events-none transition ${
              isDanger
                ? 'bg-rose-700 border border-rose-600 hover:bg-rose-600'
                : 'bg-cyan-600 border border-cyan-600 hover:bg-cyan-500'
            }`}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
