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
// Drag: pressing the pointer down on the overlay box and dragging moves every
// selected node by the same delta, patching left/top (and position: absolute
// when needed) through the store. One undo step is recorded per drag.
//
// When nothing is selected the component renders nothing.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Breakpoint, Length, NodeId, Responsive } from '../types';
import { resolveResponsive } from '../types';
import { multiSelect, useEditorStore } from '../store/useEditorStore';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SelectionOverlayProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  selection: NodeId[];
  zoom: number;
  onStartEditing?: (id: NodeId) => void;
  onContextMenu?: (x: number, y: number) => void;
}

const HANDLE = 6;
const OUTLINE_COLOUR = '#3b82f6';

// Read the resolved px length for a breakpoint, or undefined when unset/non-px.
function resolvePx(responsive: Responsive<Length | 'auto'> | undefined, bp: Breakpoint): number | undefined {
  const val = resolveResponsive(bp, responsive);
  if (!val || typeof val === 'string' || val.kind !== 'px') return undefined;
  return val.value;
}

export default function SelectionOverlay({
  iframeRef,
  selection,
  zoom,
  onStartEditing,
  onContextMenu,
}: SelectionOverlayProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const selectedId = selection.length > 0 ? selection[0]! : null;

  const patchNode = useEditorStore((state) => state.patchNode);
  const beginBatch = useEditorStore((state) => state.beginBatch);
  const endBatch = useEditorStore((state) => state.endBatch);

  // Drag state: captured on pointerDown, applied on pointerMove, cleared on
  // pointerUp. Offsets are the node left/top at drag start (iframe CSS pixels).
  const drag = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    offsets: Map<NodeId, { left: number; top: number }>;
  }>({ active: false, startX: 0, startY: 0, offsets: new Map() });

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
    const el = doc.querySelector<HTMLElement>(`[data-node-id="${selectedId}"]`);
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

  // Window-level pointer move/up so the drag keeps tracking even if the
  // pointer leaves the overlay box mid-drag.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current.active) return;
      e.preventDefault();
      const deltaX = (e.clientX - drag.current.startX) / zoom;
      const deltaY = (e.clientY - drag.current.startY) / zoom;
      const nodes = useEditorStore.getState().nodes;
      const breakpoint = useEditorStore.getState().breakpoint;
      beginBatch();
      for (const [id, offset] of drag.current.offsets) {
        const node = nodes[id];
        if (!node || node.locked || node.type === 'page') continue;
        patchNode(id, (draft) => {
          const hasPos =
            draft.styles.position?.desktop ||
            draft.styles.position?.tablet ||
            draft.styles.position?.mobile;
          if (!hasPos) draft.styles.position = { desktop: 'absolute' as const };
          draft.styles.left = { [breakpoint]: { kind: 'px', value: offset.left + deltaX } };
          draft.styles.top = { [breakpoint]: { kind: 'px', value: offset.top + deltaY } };
        });
      }
      endBatch();
    };
    const onUp = () => {
      drag.current.active = false;
      drag.current.offsets.clear();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [zoom, patchNode, beginBatch, endBatch]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || !selectedId) return;
      e.preventDefault();
      const nodes = useEditorStore.getState().nodes;
      const breakpoint = useEditorStore.getState().breakpoint;
      drag.current.active = true;
      drag.current.startX = e.clientX;
      drag.current.startY = e.clientY;
      drag.current.offsets.clear();
      for (const id of selection) {
        const node = nodes[id];
        if (!node || node.locked || node.type === 'page') continue;
        const left = resolvePx(node.styles.left, breakpoint);
        const top = resolvePx(node.styles.top, breakpoint);
        drag.current.offsets.set(id, { left: left ?? 0, top: top ?? 0 });
      }
    },
    [selectedId, selection],
  );

  const onClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // The overlay only renders for selected nodes, so clicking it is a no-op:
    // the node is already selected.
  }, []);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectedId && onStartEditing) onStartEditing(selectedId);
    },
    [selectedId, onStartEditing],
  );

  const onOverlayContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onContextMenu || !iframeRef.current) return;
      const frame = iframeRef.current.getBoundingClientRect();
      onContextMenu((e.clientX - frame.left) / zoom, (e.clientY - frame.top) / zoom);
    },
    [onContextMenu, iframeRef, zoom],
  );

  // Hit-test clicks landing in the iframe (outside the overlay): walk up from
  // the clicked target to find a data-node-id and set the selection. Canvas
  // mode only.
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
          useEditorStore.setState({
            selection: multiSelect(useEditorStore.getState().selection, id, multi),
          });
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
        pointerEvents: 'auto',
        zIndex: 2147483647,
      }}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onOverlayContextMenu}
    >
      {['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].map((side) => (
        <div key={side} style={handleStyle(side)} data-handle={side} />
      ))}
    </div>
  );
}
