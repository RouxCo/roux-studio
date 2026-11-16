// src/canvas/Canvas.tsx
// Roux Studio — live canvas.
//
// Same-origin srcdoc iframe. The editor page is rendered into the iframe body
// through a React portal: `createPortal` targets iframe.contentDocument.body,
// so the iframe's own document/window drive the tree. Rendering starts only
// after the iframe's load event. The editor's index.css (Tailwind) is never
// loaded inside the iframe — canvas output carries only renderNode's inline
// styles.
//
// The iframe width follows the active breakpoint (desktop 1440 / tablet 768 /
// mobile 390) and a `transform: scale()` zoom lets the canvas be viewed larger
// or smaller than its natural size.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Node, NodeId, Breakpoint } from '../types';
import { renderNode } from './renderNode';
import SelectionOverlay from './SelectionOverlay';
import { useEditorStore } from '../store/useEditorStore';

const BREAKPOINT_WIDTH: Record<Breakpoint, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 390,
};

// Minimal same-origin shell. No editor stylesheets are loaded here; the page is
// painted solely by renderNode's inline output inside the iframe.
const SHELL = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Roux Canvas</title></head><body style="margin:0;background:#ffffff"><div id="root"></div></body></html>`;

interface CanvasProps {
  page: Node;
  nodes: Record<NodeId, Node>;
  breakpoint: Breakpoint;
  zoom?: number;
}

export default function Canvas({ page, nodes, breakpoint, zoom = 1 }: CanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const selectedId = selection.length > 0 ? (selection[0] ?? null) : null;

  const width = BREAKPOINT_WIDTH[breakpoint] ?? 1440;

  const [loaded, setLoaded] = useState(false);
  // UI-only state (not history-tracked): the node currently being inline-edited.
  const [editingNodeId, setEditingNodeId] = useState<NodeId | null>(null);

  const startEditing = useCallback((id: NodeId) => {
    setEditingNodeId(id);
  }, []);

  const saveText = useCallback(
    (id: NodeId, text: string) => {
      setEditingNodeId(null);
      useEditorStore.getState().patchNode(id, (draft) => {
        if (
          draft.type === 'heading' ||
          draft.type === 'paragraph' ||
          draft.type === 'button' ||
          draft.type === 'link'
        ) {
          draft.text = text;
        }
      });
    },
    [],
  );

  const cancelEditing = useCallback(() => {
    setEditingNodeId(null);
  }, []);

  const render = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !loaded) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    const container = doc.body;
    if (!container) return;
    return createPortal(
      renderNode(page, {
        mode: 'canvas',
        breakpoint,
        nodes,
        editingNodeId,
        onStartEditing: startEditing,
        onSaveText: (id, text) => saveText(id, text),
        onCancelEditing: cancelEditing,
      }),
      container,
    );
  }, [page, nodes, breakpoint, loaded, editingNodeId, startEditing, saveText, cancelEditing]);

  const [element, setElement] = useState<React.ReactNode>(null);

  useEffect(() => {
    const go = () => {
      const el = render();
      if (el) setElement(el);
    };
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (loaded) {
      go();
    } else {
      iframe.addEventListener('load', go);
      return () => iframe.removeEventListener('load', go);
    }
  }, [render, loaded]);

  // Delegated click in the iframe canvas: clicking a rendered node selects it,
  // keeping the layers tree and canvas selection in sync (both read the store).
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !loaded) return undefined;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return undefined;
    const handler = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest('[data-node-id]');
      const id = el?.getAttribute('data-node-id') ?? null;
      if (id) setSelection([id]);
    };
    doc.addEventListener('click', handler);
    return () => doc.removeEventListener('click', handler);
  }, [loaded, setSelection]);

  return (
    <>
      <iframe
        ref={iframeRef}
        srcDoc={SHELL}
        onLoad={() => setLoaded(true)}
        style={{
          width: width,
          height: '100%',
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
          border: 0,
          display: 'block',
        }}
      />
      {loaded ? (
        <>
          {element}
          <SelectionOverlay
            iframeRef={iframeRef}
            selectedId={selectedId}
            zoom={zoom}
          />
        </>
      ) : null}
    </>
  );
}
