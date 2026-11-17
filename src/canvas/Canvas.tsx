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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Node, NodeId, Breakpoint, PageId, Project } from '../types';
import { renderNode } from './renderNode';
import { compileStyles } from '../compile/compileStyles';
import SelectionOverlay from './SelectionOverlay';
import ContextMenu from '../components/ContextMenu';
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
  onContextMenu?: (x: number, y: number) => void;
}

export default function Canvas({ page, nodes, breakpoint, zoom = 1, onContextMenu }: CanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const selectedId = selection.length > 0 ? (selection[0] ?? null) : null;

  const width = BREAKPOINT_WIDTH[breakpoint] ?? 1440;

  // Project data from the editor store, shaped into a Project for compileStyles.
  // createdAt/updatedAt aren't tracked by the store and aren't read by compileStyles.
  const projectId = useEditorStore((state) => state.projectId);
  const projectName = useEditorStore((state) => state.projectName);
  const pages = useEditorStore((state) => state.pages);
  const tokens = useEditorStore((state) => state.tokens);
  const currentPageId = useEditorStore((state) => state.currentPageId);
  const playBackgrounds = useEditorStore((state) => state.playBackgrounds);
  // PageId (e.g. 'pg-1'), not the page node id (e.g. 'page-1'): fall back to the
  // page whose rootId matches the rendered page node.
  const pageId =
    currentPageId ?? pages.find((p) => p.rootId === page.id)?.id ?? '';

  const project = useMemo<Project>(
    () => ({
      id: projectId ?? 'project',
      name: projectName,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      pages,
      tokens,
    }),
    [projectId, projectName, pages, tokens]
  );

  const [loaded, setLoaded] = useState(false);
  // UI-only state (not history-tracked): the node currently being inline-edited.
  const [editingNodeId, setEditingNodeId] = useState<NodeId | null>(null);
  // Right-click context menu, positioned within the iframe so iframe-relative
  // client coordinates line up without any main-window transform math.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

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
      <>
        {renderNode(page, {
          mode: 'canvas',
          breakpoint,
          nodes,
          editingNodeId,
          playBackgrounds,
          onStartEditing: startEditing,
          onSaveText: (id, text) => saveText(id, text),
          onCancelEditing: cancelEditing,
        })}
        {menu && (
          <ContextMenu
            open={true}
            x={menu.x}
            y={menu.y}
            onClose={closeMenu}
          />
        )}
      </>,
      container,
    );
  }, [page, nodes, breakpoint, loaded, editingNodeId, startEditing, saveText, cancelEditing, menu, playBackgrounds]);

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
      setMenu(null);
    };
    doc.addEventListener('click', handler);
    return () => doc.removeEventListener('click', handler);
  }, [loaded, setSelection]);

  // Delegated right-click in the iframe canvas: select the clicked node and open
  // the context menu at the click position (iframe-relative client coords).
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !loaded) return undefined;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return undefined;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      const el = (e.target as Element | null)?.closest('[data-node-id]');
      const id = el?.getAttribute('data-node-id') ?? null;
      if (id) setSelection([id]);
      setMenu(null);
      onContextMenu?.(e.clientX, e.clientY);
    };
    doc.addEventListener('contextmenu', handler);
    return () => doc.removeEventListener('contextmenu', handler);
  }, [loaded, setSelection]);

  // Inject the compiled CSS into the canvas iframe: one shared <style id="roux-compiled">
  // holds every node's r-<hash> rule (desktop base + breakpoint media queries). Recompiles
  // whenever project/pages/tokens or the node set changes, throttled to one paint per
  // animation frame so style edits don't thrash the iframe.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !loaded) return undefined;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return undefined;
    let frame: number | null = null;
    const flush = () => {
      frame = null;
      const head = doc.head || doc.getElementsByTagName('head')[0];
      if (!head) return;
      let style = doc.getElementById('roux-compiled') as HTMLStyleElement | null;
      if (!style) {
        style = doc.createElement('style');
        style.id = 'roux-compiled';
        head.appendChild(style);
      }
      style.textContent = compileStyles(project, pageId as PageId, nodes);
    };
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(flush);
    };
    schedule();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [loaded, project, pageId, nodes]);

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
