// src/canvas/SelectionOverlay.tsx
// Roux Studio — selection overlay.
//
// Draws a selection outline and eight resize handles around the currently
// selected element in the editor document. The overlay lives in the editor
// document layer, outside the iframe, so it paints on top of the canvas.
// Its box is computed from the selected element's getBoundingClientRect(),
// adjusted for the iframe's offset (viewport position minus iframe position)
// and for the canvas zoom.
//
// Clicks that land in the iframe are hit-tested through the target element's
// data-node-id attribute (canvas mode only — renderNode only emits that
// attribute in canvas mode) to set the selection in useEditorStore.
//
// When nothing is selected the component renders nothing.
import { useCallback, useEffect, useState } from 'react';
import type { NodeId } from '../types';
import { multiSelect, useEditorStore } from '../store/useEditorStore';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SelectionOverlayProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  selectedId: NodeId | null;
  zoom: number;
}

const HANDLE = 6;
const OUTLINE_COLOUR = '#3b82f6';

export default function SelectionOverlay({
  iframeRef,
  selectedId,
  zoom,
}: SelectionOverlayProps) {
  const [rect, setRect] = useState<Rect | null>(null);

  const compute = useCallback(() => {
    const iframe = iframeRef.current;
    if (!selectedId || !iframe) {
      setRect(null);
      return;
    }
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      setRect(null);
      return;
    }
    const el = doc.querySelector<HTMLElement>(
      `[data-node-id="${selectedId}"]`,
    );
    if (!el) {
      setRect(null);
      return;
    }
    // inner: element box relative to the iframe viewport (unscaled).
    // frame: iframe box in the outer viewport (scaled by the CSS transform).
    const inner = el.getBoundingClientRect();
    const frame = iframe.getBoundingClientRect();
    setRect({
      left: frame.left + inner.left * zoom,
      top: frame.top + inner.top * zoom,
      width: inner.width * zoom,
      height: inner.height * zoom,
    });
  }, [iframeRef, selectedId, zoom]);

  useEffect(() => {
    compute();
    window.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, [compute]);

  // Hit-test clicks landing in the iframe: walk up from the clicked target to
  // find a data-node-id and set the selection. Canvas mode only.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    const onClick = (event: MouseEvent) => {
      let target = event.target as Element | null;
      const root = doc.documentElement;
      while (target && target !== root) {
        const id = target.getAttribute('data-node-id');
        if (id) {
          const multi = event.shiftKey || event.metaKey || event.ctrlKey;
          const current = useEditorStore.getState().selection;
          useEditorStore.setState({ selection: multiSelect(current, id, multi) });
          return;
        }
        target = target.parentElement;
      }
    };
    doc.addEventListener('click', onClick);
    return () => doc.removeEventListener('click', onClick);
  }, [iframeRef]);

  if (!selectedId || !rect) return null;
  const half = HANDLE / 2;

  const handleStyle = (side: string): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: 'absolute',
      width: HANDLE,
      height: HANDLE,
      background: OUTLINE_COLOUR,
      border: `1px solid #ffffff`,
      borderRadius: 2,
      zIndex: 1,
    };
    switch (side) {
      case 'nw':
        style.top = -half;
        style.left = -half;
        break;
      case 'n':
        style.top = -half;
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;
      case 'ne':
        style.top = -half;
        style.right = -half;
        break;
      case 'w':
        style.top = '50%';
        style.left = -half;
        style.transform = 'translateY(-50%)';
        break;
      case 'e':
        style.top = '50%';
        style.right = -half;
        style.transform = 'translateY(-50%)';
        break;
      case 'sw':
        style.bottom = -half;
        style.left = -half;
        break;
      case 's':
        style.bottom = -half;
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;
      case 'se':
        style.bottom = -half;
        style.right = -half;
        break;
    }
    return style;
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        border: `2px solid ${OUTLINE_COLOUR}`,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 2147483647,
      }}
    >
      {['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].map((side) => (
        <div key={side} style={handleStyle(side)} data-handle={side} />
      ))}
    </div>
  );
}
