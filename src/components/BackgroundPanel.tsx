// src/components/BackgroundPanel.tsx
// Roux Studio — background layer stack panel for page/section nodes.
//
// Renders the selected node's backgroundLayers (top layer first) as a
// sortable list, with an "Add layer" menu of the seven layer kinds and an
// expandable control set per layer. Every change is committed through
// useEditorStore as one undo step (continuous drags coalesce between
// beginBatch/endBatch). Background layers are not nodes — LayersTree is
// untouched.
import { useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  GripHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import type {
  BackgroundLayer,
  BackgroundLayerType,
  BlendMode,
  Node,
  NodeId,
} from '../types';
import { clampSlideshow } from '../compile/backgrounds';

const LAYER_KINDS: BackgroundLayerType[] = [
  'color',
  'gradient',
  'image',
  'video',
  'noise',
  'tint',
  'slideshow',
];

const KIND_LABEL: Record<BackgroundLayerType, string> = {
  color: 'Color',
  gradient: 'Gradient',
  image: 'Image',
  video: 'Video',
  noise: 'Noise',
  tint: 'Tint',
  slideshow: 'Slideshow',
};

const BLEND_MODES: BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];

interface BackgroundPanelProps {
  nodeId: NodeId;
}

export default function BackgroundPanel({ nodeId }: BackgroundPanelProps) {
  const node = useEditorStore((state) => state.nodes[nodeId]);
  const layers = (node && ('backgroundLayers' in node)
    ? (node as Extract<Node, { backgroundLayers: BackgroundLayer[] }>).backgroundLayers
    : []) as BackgroundLayer[];

  const addLayer = useEditorStore((state) => state.addLayer);
  const moveLayer = useEditorStore((state) => state.moveLayer);

  const [addKind, setAddKind] = useState<BackgroundLayerType | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const sensors = useSensors({
    sensor: PointerSensor,
    options: { activationConstraint: { distance: 8 } },
  });

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const draggedId = active.id as string;
      const oldIndex = layers.findIndex((layer) => layer.id === draggedId);
      if (oldIndex < 0) return;
      let newIndex = oldIndex;
      if (over) {
        const overIndex = layers.findIndex(
          (layer) => layer.id === (over.id as string),
        );
        if (overIndex >= 0) newIndex = overIndex;
      }
      if (newIndex !== oldIndex) {
        moveLayer(nodeId, oldIndex, newIndex);
      }
    },
    [layers, nodeId, moveLayer],
  );

  const handleAddLayer = useCallback(
    (kind: BackgroundLayerType) => {
      addLayer(nodeId, kind);
      setAddKind(null);
    },
    [nodeId, addLayer],
  );

  if (!node || !('backgroundLayers' in node)) return null;

  return (
    <section className="border-t border-slate-800 pt-4 pb-2">
      <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
        Background
      </h3>

      {/* Add layer menu */}
      <div className="px-2 mb-3">
        <button
          onClick={() => setAddKind(addKind ? null : 'color')}
          className="rounded-md border border-slate-700 bg-slate-900 text-xs text-slate-200 px-3 py-1 hover:bg-slate-800"
          aria-label="Add background layer"
        >
          {addKind ? 'Close' : <Plus size={12} strokeWidth={2} />}&nbsp; Add layer
        </button>
        {addKind && (
          <div className="mt-2 flex flex-wrap gap-1">
            {LAYER_KINDS.map((kind) => (
              <button
                key={kind}
                onClick={() => handleAddLayer(kind)}
                className="rounded-md border border-slate-700 bg-slate-900/80 text-xs text-slate-300 px-2.5 py-1 hover:bg-slate-800 hover:text-slate-100"
                title={`Add ${KIND_LABEL[kind]}`}
              >
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
        )}
      </div>

      {layers.length === 0 && (
        <div className="px-4 py-3 text-xs text-slate-500 italic">
          No background layers. Add one to stack colours, gradients, images
          and more.
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={layers.map((layer) => layer.id)}
          strategy={verticalListSortingStrategy}
        >
          {layers.map((layer) => (
            <SortableLayerRow
              key={layer.id}
              nodeId={nodeId}
              layer={layer}
              openId={openId}
              setOpenId={setOpenId}
            />
          ))}
          <DragOverlay />
        </SortableContext>
      </DndContext>
    </section>
  );
}

interface SortableLayerRowProps {
  nodeId: NodeId;
  layer: BackgroundLayer;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}

function SortableLayerRow({
  nodeId,
  layer,
  openId,
  setOpenId,
}: SortableLayerRowProps) {
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const removeLayer = useEditorStore((state) => state.removeLayer);
  const duplicateLayer = useEditorStore((state) => state.duplicateLayer);
  const toggleLayer = useEditorStore((state) => state.toggleLayer);
  const beginBatch = useEditorStore((state) => state.beginBatch);
  const endBatch = useEditorStore((state) => state.endBatch);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: layer.id, data: { layer } });

  const isOpen = openId === layer.id;
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(layer.name ?? '');
  const enabled = layer.enabled !== false;
  const style = {
    ...(transform
      ? {
          transform: `translate3d(${transform.x}px,${transform.y}px,0) scale(${transform.scaleX},${transform.scaleY})`,
        }
      : {}),
    opacity: isDragging ? 0 : 1,
  };

  const handleSaveName = () => {
    if (!editingName) return;
    updateLayer(nodeId, layer.id, { name: nameDraft || undefined });
    setEditingName(false);
  };

  const handleOpacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateLayer(nodeId, layer.id, { opacity: Number(event.target.value) });
  };

  const handleOpacityPointerDown = () => {
    beginBatch();
  };

  const handleOpacityPointerUp = () => {
    endBatch();
  };

  const handleBlendChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    updateLayer(nodeId, layer.id, {
      blendMode: event.target.value as BlendMode,
    });
  };

  const handleDuplicate = () => {
    duplicateLayer(nodeId, layer.id);
  };

  const handleDelete = () => {
    removeLayer(nodeId, layer.id);
    if (openId === layer.id) setOpenId(null);
  };

  const toggle = () => {
    setOpenId(openId === layer.id ? null : layer.id);
  };

  const label = layer.name ?? layer.type;

  return (
    <>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={style}
        className="group relative flex items-center gap-2 px-2 py-1.5 text-sm rounded-md border border-transparent mb-1"
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
      >
        <div
          className="flex w-5 h-5 shrink-0 items-center justify-center rounded bg-slate-800 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripHorizontal size={14} strokeWidth={2} />
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation();
            toggleLayer(nodeId, layer.id);
          }}
          className="w-5 h-5 shrink-0 rounded-md bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-slate-200"
          aria-label={enabled ? 'Show layer' : 'Hide layer'}
          aria-pressed={!enabled}
        >
          {enabled ? <Eye size={12} strokeWidth={2} /> : <EyeOff size={12} strokeWidth={2} />}
        </button>

        {editingName ? (
          <input
            autoFocus
            value={nameDraft}
            className="flex-1 shrink-0 w-0 min-w-0 rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSaveName();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setEditingName(false);
              }
            }}
          />
        ) : (
          <span
            className="flex-1 shrink-0 w-0 min-w-0 truncate text-xs text-slate-300 cursor-pointer"
            onDoubleClick={() => {
              setNameDraft(layer.name ?? '');
              setEditingName(true);
            }}
          >
            {label}
          </span>
        )}

        <button
          onClick={(event) => {
            event.stopPropagation();
            handleDuplicate();
          }}
          className="w-5 h-5 shrink-0 rounded-md bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-slate-200"
          title="Duplicate layer"
          aria-label="Duplicate layer"
        >
          <Copy size={12} strokeWidth={2} />
        </button>

        <button
          onClick={(event) => {
            event.stopPropagation();
            handleDelete();
          }}
          className="w-5 h-5 shrink-0 rounded-md bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-red-400"
          title="Delete layer"
          aria-label="Delete layer"
        >
          <Trash2 size={12} strokeWidth={2} />
        </button>

        <button
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
          className="w-5 h-5 shrink-0 rounded-md bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-slate-200"
          aria-label={isOpen ? 'Collapse' : 'Expand'}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronDown size={12} strokeWidth={2} />
          ) : (
            <ChevronRight size={12} strokeWidth={2} />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="px-4 py-2 border-t border-slate-800/50 bg-slate-900/30">
          <div className="grid grid-cols-3 gap-3 text-xs mb-2">
            <div className="col-span-3">
              <label className="block text-[10px] text-slate-500 mb-1">Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={layer.opacity}
                onChange={handleOpacityChange}
                onPointerDown={handleOpacityPointerDown}
                onPointerUp={handleOpacityPointerUp}
                onPointerLeave={handleOpacityPointerUp}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 mt-0.5">
                {(layer.opacity * 100).toFixed(0)}%
              </span>
            </div>

            <div className="col-span-3">
              <label className="block text-[10px] text-slate-500 mb-1">Blend mode</label>
              <select
                value={layer.blendMode}
                onChange={handleBlendChange}
                className="w-full rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
              >
                {BLEND_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Per-kind controls */}
          {layer.type === 'color' || layer.type === 'tint' ? (
            <ColorControls layer={layer} nodeId={nodeId} updateLayer={updateLayer} />
          ) : layer.type === 'gradient' ? (
            <GradientControls layer={layer} nodeId={nodeId} updateLayer={updateLayer} />
          ) : layer.type === 'image' ? (
            <ImageControls layer={layer} nodeId={nodeId} updateLayer={updateLayer} />
          ) : layer.type === 'video' ? (
            <VideoControls layer={layer} nodeId={nodeId} updateLayer={updateLayer} />
          ) : layer.type === 'noise' ? (
            <NoiseControls layer={layer} nodeId={nodeId} updateLayer={updateLayer} />
          ) : layer.type === 'slideshow' ? (
            <SlideshowControls layer={layer} nodeId={nodeId} updateLayer={updateLayer} />
          ) : null}
        </div>
      )}
    </>
  );
}

interface KindControlsProps {
  layer: BackgroundLayer;
  nodeId: NodeId;
  updateLayer: (nodeId: NodeId, layerId: string, patch: Partial<BackgroundLayer>) => void;
}

function ColorControls({ layer, nodeId, updateLayer }: KindControlsProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateLayer(nodeId, layer.id, { color: event.target.value });
  };
  const tintOrColor = layer as Extract<BackgroundLayer, { type: 'color' } | { type: 'tint' }>;
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-3">
        <label className="block text-[10px] text-slate-500 mb-1">Colour</label>
        <input
          value={tintOrColor.color}
          onChange={handleChange}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

function GradientControls({ layer, nodeId, updateLayer }: KindControlsProps) {
  const gradient = layer as Extract<BackgroundLayer, { type: 'gradient' }>;
  const handleAngleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateLayer(nodeId, layer.id, { angle: Number(event.target.value) });
  };
  const handleStopChange = (stopIndex: number) => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const stops = [...gradient.stops];
    const existing = stops[stopIndex];
    if (!existing) return;
    stops[stopIndex] = { ...existing, color: event.target.value };
    updateLayer(nodeId, layer.id, { stops });
  };
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-1">
        <label className="block text-[10px] text-slate-500 mb-1">Angle</label>
        <input
          type="number"
          value={gradient.angle}
          onChange={handleAngleChange}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
      <div className="col-span-2">
        <label className="block text-[10px] text-slate-500 mb-1">Stops</label>
        <div className="flex gap-2">
          {gradient.stops.map((stop, i) => (
            <div key={i} className="flex-1 min-w-0">
              <input
                value={stop.color}
                onChange={handleStopChange(i)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 text-center mt-0.5">
                {stop.offset}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageControls({ layer, nodeId, updateLayer }: KindControlsProps) {
  const image = layer as Extract<BackgroundLayer, { type: 'image' }>;
  const handleField = (
    key: 'src' | 'position' | 'repeat',
  ) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    updateLayer(nodeId, layer.id, { [key]: event.target.value } as Partial<BackgroundLayer>);
  };
  const handleSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    updateLayer(nodeId, layer.id, { size: event.target.value as 'cover' | 'contain' | 'auto' });
  };
  const handleNumber = (
    key: 'blur' | 'brightness',
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    updateLayer(nodeId, layer.id, { [key]: Number(event.target.value) } as Partial<BackgroundLayer>);
  };
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-3">
        <label className="block text-[10px] text-slate-500 mb-1">Image src</label>
        <input
          value={image.src}
          onChange={handleField('src')}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
      <div className="col-span-1">
        <label className="block text-[10px] text-slate-500 mb-1">Size</label>
        <select
          value={image.size}
          onChange={handleSizeChange}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        >
          <option value="cover">Cover</option>
          <option value="contain">Contain</option>
          <option value="auto">Auto</option>
        </select>
      </div>
      <div className="col-span-1">
        <label className="block text-[10px] text-slate-500 mb-1">Position</label>
        <input
          value={image.position}
          onChange={handleField('position')}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
      <div className="col-span-1">
        <label className="block text-[10px] text-slate-500 mb-1">Repeat</label>
        <select
          value={image.repeat}
          onChange={handleField('repeat')}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        >
          <option value="no-repeat">No-repeat</option>
          <option value="repeat">Repeat</option>
          <option value="repeat-x">Repeat-x</option>
          <option value="repeat-y">Repeat-y</option>
        </select>
      </div>
      <div className="col-span-1">
        <label className="block text-[10px] text-slate-500 mb-1">Blur (px)</label>
        <input
          type="number"
          value={image.blur ?? 0}
          onChange={handleNumber('blur')}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
      <div className="col-span-1">
        <label className="block text-[10px] text-slate-500 mb-1">Brightness</label>
        <input
          type="number"
          step="0.1"
          value={image.brightness ?? 1}
          onChange={handleNumber('brightness')}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

function VideoControls({ layer, nodeId, updateLayer }: KindControlsProps) {
  const video = layer as Extract<BackgroundLayer, { type: 'video' }>;
  const handleField = (
    key: 'src' | 'poster',
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    updateLayer(nodeId, layer.id, { [key]: event.target.value } as Partial<BackgroundLayer>);
  };
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-2">
        <label className="block text-[10px] text-slate-500 mb-1">Video src</label>
        <input
          value={video.src}
          onChange={handleField('src')}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
      <div className="col-span-1">
        <label className="block text-[10px] text-slate-500 mb-1">Poster</label>
        <input
          value={video.poster}
          onChange={handleField('poster')}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

function NoiseControls({ layer, nodeId, updateLayer }: KindControlsProps) {
  const noise = layer as Extract<BackgroundLayer, { type: 'noise' }>;
  const handleNumber = (
    key: 'intensity' | 'scale',
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    updateLayer(nodeId, layer.id, { [key]: Number(event.target.value) } as Partial<BackgroundLayer>);
  };
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-1">
        <label className="block text-[10px] text-slate-500 mb-1">Intensity</label>
        <input
          type="number"
          step="0.01"
          value={noise.intensity ?? 0.15}
          onChange={handleNumber('intensity')}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
      <div className="col-span-1">
        <label className="block text-[10px] text-slate-500 mb-1">Scale</label>
        <input
          type="number"
          step="0.01"
          value={noise.scale ?? 0.8}
          onChange={handleNumber('scale')}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

function SlideshowControls({ layer, nodeId, updateLayer }: KindControlsProps) {
  const slideshow = layer as Extract<BackgroundLayer, { type: 'slideshow' }>;
  const clamped = clampSlideshow(slideshow);
  const handleSrcsChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateLayer(nodeId, layer.id, {
      srcs: event.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
    } as Partial<BackgroundLayer>);
  };
  const handleIntervalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateLayer(nodeId, layer.id, { interval: Number(event.target.value) } as Partial<BackgroundLayer>);
  };
  const handleTransitionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateLayer(nodeId, layer.id, { transition: Number(event.target.value) } as Partial<BackgroundLayer>);
  };
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-3">
        <label className="block text-[10px] text-slate-500 mb-1">Image srcs (one per line)</label>
        <textarea
          value={slideshow.srcs.join('\n')}
          onChange={handleSrcsChange}
          rows={3}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
      <div className="col-span-1">
        <label className="block text-[10px] text-slate-500 mb-1">Interval (ms)</label>
        <input
          type="number"
          value={slideshow.interval}
          onChange={handleIntervalChange}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
      <div className="col-span-1">
        <label className="block text-[10px] text-slate-500 mb-1">Transition (ms)</label>
        <input
          type="number"
          value={slideshow.transition ?? 600}
          onChange={handleTransitionChange}
          className="rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none"
        />
      </div>
      <div className="col-span-3">
        <p className="text-[10px] text-slate-500">
          Clamped: interval {clamped.interval} ms · transition {clamped.transition} ms
        </p>
      </div>
    </div>
  );
}
