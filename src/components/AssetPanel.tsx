// Roux Studio — Asset panel.
//
// Uploads files (images, video, documents) into the IndexedDB assets store via
// `addAsset`, lists them with thumbnail previews, and lets the user insert an
// asset as an `image` node into the canvas. Individual assets can be deleted and
// orphan blobs swept with `cleanUnusedAssets`. Asset blobs live outside the
// project data model, so none of these actions are history-tracked.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { getAllAssets, deleteAsset, type StoredAsset } from '../db/stores';
import { CONTAINMENT_RULES } from '../store/containment';
import ConfirmDialog from './ConfirmDialog';
import type { ElementType, Node, NodeId } from '../types';
import { nanoid } from 'nanoid';

const TYPE_LABEL: Record<string, string> = {
  image: 'Image',
  video: 'Video',
};

function byteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canContain(parentType: ElementType | 'root', childType: ElementType): boolean {
  const allowed =
    parentType === 'root' ? CONTAINMENT_RULES.page : CONTAINMENT_RULES[parentType];
  return Boolean(allowed?.has(childType));
}

// Where an image node may be inserted: the selected node if it can contain an
// image, otherwise its parent, otherwise nowhere (an image may not go at the
// page root).
function pickInsertTarget(): NodeId | null {
  const state = useEditorStore.getState();
  const sel = state.selection;
  const selected = sel.length > 0 ? state.nodes[sel[0]!] : undefined;

  if (selected && canContain(selected.type as ElementType, 'image')) {
    return selected.id;
  }
  if (selected && selected.parentId !== null) {
    const parent = state.nodes[selected.parentId];
    const parentType = parent?.type;
    if (parentType && canContain(parentType, 'image')) {
      return selected.parentId;
    }
  }
  return null;
}

interface AssetRowProps {
  asset: StoredAsset;
  url: string;
}

function AssetRow({ asset, url }: AssetRowProps) {
  const addNode = useEditorStore((state) => state.addNode);
  const setSelection = useEditorStore((state) => state.setSelection);
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);
  const [inserting, setInserting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const clearMessage = () => setMessage(null);

  const handleInsert = async () => {
    const target = pickInsertTarget();
    if (!target) {
      setMessage({ text: "Can't insert an image here — select a section, container, box or card first.", kind: 'error' });
      setTimeout(clearMessage, 4000);
      return;
    }
    setInserting(true);
    try {
      const id = nanoid();
      const node: Node = {
        id,
        type: 'image',
        parentId: target,
        children: [],
        styles: {},
        hidden: {},
        locked: false,
        src: asset.id,
        alt: asset.name,
      };
      addNode(node, target);
      setSelection([id]);
      setMessage({ text: 'Inserted', kind: 'ok' });
      setTimeout(clearMessage, 2000);
    } catch {
      setMessage({ text: "Can't insert an image here.", kind: 'error' });
      setTimeout(clearMessage, 4000);
    } finally {
      setInserting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAsset(asset.id);
      setMessage({ text: 'Deleted', kind: 'ok' });
      setTimeout(clearMessage, 2000);
    } catch {
      setMessage({ text: 'Delete failed.', kind: 'error' });
      setTimeout(clearMessage, 4000);
    } finally {
      setDeleting(false);
    }
  };

  const isImage = asset.mimeType.startsWith('image/');

  return (
    <div
      className="group flex items-start gap-2 px-3 py-2.5 rounded-lg border border-transparent hover:border-slate-700 hover:bg-slate-800 transition cursor-default"
    >
      <div className="flex-shrink-0 w-12 h-12 rounded border border-slate-700 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
        {isImage ? (
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
            <Image className="w-5 h-5 text-slate-500" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate text-sm font-medium text-slate-200">{asset.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleInsert();
            }}
            disabled={inserting}
            className="w-6 h-6 shrink-0 rounded-md border border-slate-700 bg-slate-900 text-slate-400 flex items-center justify-center text-[10px] disabled:opacity-50 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Insert as image"
          >
            <Plus size={12} strokeWidth={2} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            disabled={deleting}
            className="w-6 h-6 shrink-0 rounded-md border border-slate-700 bg-slate-900 text-slate-400 flex items-center justify-center text-[10px] disabled:opacity-50 hover:bg-slate-800 hover:text-red-400 hover:border-red-500"
            aria-label="Delete"
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </div>
        <span className="text-[10px] text-slate-500">
          {TYPE_LABEL[(asset.mimeType.split('/')[0] ?? '')] ?? asset.mimeType} · {byteSize(
            asset.blob.size,
          )}
        </span>
        {message && (
          <p className="mt-1 text-[11px] leading-snug" style={{ color: message.kind === 'error' ? '#f87171' : '#86efac' }}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

// `deleteAsset` is imported from the DB layer directly here (it's not part of the
// store interface) so the row can delete a blob without touching project data.
interface AssetPanelProps {
  open?: boolean;
}

export default function AssetPanel({ open = true }: AssetPanelProps) {
  const addAssetStore = useEditorStore((state) => state.addAsset);
  const cleanUnused = useEditorStore((state) => state.cleanUnusedAssets);
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  // Blob URLs for thumbnails, keyed by asset id; revoked whenever the list changes
  // or the panel unmounts.
  const urlRef = useRef<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanOpen, setCleanOpen] = useState(false);

  const clearMessage = () => setMessage(null);

  const revokeAll = useCallback(() => {
    for (const url of Object.values(urlRef.current)) {
      URL.revokeObjectURL(url);
    }
    urlRef.current = {};
  }, []);

  const loadAssets = useCallback(async () => {
    const list = await getAllAssets();
    setAssets(list.sort((a, b) => b.name.localeCompare(a.name)));
  }, []);

  useEffect(() => {
    loadAssets();
    return () => revokeAll();
  }, [loadAssets, revokeAll]);

  // Refresh thumbnails whenever the asset list changes.
  useEffect(() => {
    revokeAll();
    const next: Record<string, string> = {};
    for (const a of assets) {
      next[a.id] = URL.createObjectURL(a.blob);
    }
    urlRef.current = next;
  }, [assets, revokeAll]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await addAssetStore(files[i]!);
      }
      await loadAssets();
      setMessage({ text: `Uploaded ${files.length} file(s).`, kind: 'ok' });
      setTimeout(clearMessage, 2500);
    } catch {
      setMessage({ text: 'Upload failed.', kind: 'error' });
      setTimeout(clearMessage, 4000);
    } finally {
      setUploading(false);
    }
  };

  const handleClean = async () => {
    setCleaning(true);
    try {
      const deleted = await cleanUnused();
      await loadAssets();
      setMessage({ text: `Cleaned ${deleted} unused asset(s).`, kind: 'ok' });
      setTimeout(clearMessage, 3000);
    } catch {
      setMessage({ text: 'Clean failed.', kind: 'error' });
      setTimeout(clearMessage, 4000);
    } finally {
      setCleaning(false);
    }
  };

  if (!open) return null;

  return (
    <>
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
        Assets
        <button
          onClick={() => setCleanOpen(true)}
          disabled={cleaning}
          className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 bg-slate-800 text-[10px] text-slate-300 disabled:opacity-50 hover:bg-slate-700 hover:text-slate-100"
          aria-label="Clean unused assets"
        >
          <RefreshCw size={10} strokeWidth={2} />
          <span>Clean unused</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-3">
          <label
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-700 bg-slate-800/50 cursor-pointer hover:border-slate-500 hover:bg-slate-800 transition"
          >
            <input
              type="file"
              accept="image/*,video/*,application/pdf"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="sr-only"
            />
            <Plus size={14} strokeWidth={2} />
            <span className="text-sm text-slate-300">Upload assets</span>
            {uploading && <span className="text-[10px] text-slate-500 ml-2">…</span>}
          </label>
          <p className="mt-1 text-[10px] text-slate-500 max-w-xs">
            Images, video and documents are stored as blobs; only referenced
            assets survive a project save.
          </p>
        </div>

        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Image className="w-10 h-10 text-slate-600 mb-2" />
            <p className="text-sm text-slate-400 max-w-xs text-center">
              No assets yet. Upload a file, then insert it as an image.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {assets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} url={urlRef.current[asset.id] ?? ''} />
            ))}
          </div>
        )}
        {message && (
          <p className="mt-3 px-3 text-[11px] leading-snug" style={{ color: message.kind === 'error' ? '#f87171' : '#86efac' }}>
            {message.text}
          </p>
        )}
      </div>
    </div>

    <ConfirmDialog
      open={cleanOpen}
      onClose={() => setCleanOpen(false)}
      title="Clean unused assets"
      body="This will delete every asset blob that no node references (unused images, videos and documents). It can't be undone."
      confirmLabel="Clean now"
      confirmVariant="danger"
      loading={cleaning}
      onConfirm={async () => {
        setCleanOpen(false);
        await handleClean();
      }}
    />
    </>
  );
}
