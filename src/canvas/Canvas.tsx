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

  const width = BREAKPOINT_WIDTH[breakpoint] ?? 1440;

  const render = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    const container = doc.body;
    if (!container) return;
    return createPortal(
      renderNode(page, { mode: 'canvas', breakpoint, nodes }),
      container,
    );
  }, [page, nodes, breakpoint]);

  const [element, setElement] = useState<React.ReactNode>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const go = () => {
      const el = render();
      if (el) setElement(el);
    };
    if (iframe.contentDocument) {
      go();
    } else {
      iframe.addEventListener('load', go);
      return () => iframe.removeEventListener('load', go);
    }
  }, [render]);

  return (
    <>
      <iframe
        ref={iframeRef}
        srcDoc={SHELL}
        style={{
          width: width,
          height: '100%',
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
          border: 0,
          display: 'block',
        }}
      />
      {element}
    </>
  );
}
