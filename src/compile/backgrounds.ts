// src/compile/backgrounds.ts
// Roux Studio — background layer compilation (pure, no React, no DOM).
//
// backgroundLayers[0] is the TOP layer of the stack.
// Fast path: a single `background:` list on the element, visible layers top-first.
// Layered path: an aria-hidden .r-bg div (first child of the page/section) holding
// one .r-bg-layer per visible layer in REVERSE DOM order (bottom layer first).
// The shared .r-bg rule is emitted once in compileBaseStyles (compileStyles.ts),
// not per node.
import type { BackgroundLayer, BackgroundLayerType, Node, SlideshowLayer } from '../types';
import { isPageNode, isSectionNode } from '../types';
import { classFor } from './classFor';
import { nanoid } from 'nanoid';

function noiseSVG(scale: number): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
    `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${scale}" numOctaves="2" stitchTiles="stitch"/></filter>` +
    '<rect width="100%" height="100%" filter="url(#n)"/></svg>'
  );
}

export function visibleLayers(layers: BackgroundLayer[]): BackgroundLayer[] {
  return layers.filter((layer) => layer.enabled !== false);
}

export function needsLayeredPath(layers: BackgroundLayer[]): boolean {
  return visibleLayers(layers).some((layer) =>
    layer.opacity < 1 ||
    layer.blendMode !== 'normal' ||
    layer.type === 'video' ||
    layer.type === 'slideshow' ||
    layer.type === 'noise' ||
    (layer.type === 'image' &&
      ((layer.blur ?? 0) > 0 || (layer.brightness ?? 1) !== 1))
  );
}

export function layerImage(layer: BackgroundLayer): string {
  switch (layer.type) {
    case 'color':
      return `linear-gradient(${layer.color}, ${layer.color})`;
    case 'tint':
      return `linear-gradient(${layer.color || 'rgba(0,0,0,0.4)'}, ${layer.color || 'rgba(0,0,0,0.4)'})`;
    case 'gradient': {
      const stops = layer.stops.map((s) => `${s.color} ${s.offset}%`).join(', ');
      return `linear-gradient(${layer.angle}deg, ${stops})`;
    }
    case 'image':
      return `url("${layer.src}")`;
    case 'video':
      return `url("${layer.poster}")`;
    case 'slideshow':
      return `url("${layer.srcs[0]}")`;
    case 'noise':
      return `url("data:image/svg+xml,${encodeURIComponent(noiseSVG(layer.scale ?? 0.8))}")`;
  }
}

export function fastBackground(layers: BackgroundLayer[]): string {
  return visibleLayers(layers).map((layer) => {
    const image = layerImage(layer);
    if (layer.type === 'image') {
      return `${image} ${layer.position}/${layer.size} ${layer.repeat}`;
    }
    return image;
  }).join(', ');
}

export function layerClass(layer: BackgroundLayer): string {
  return `r-bgl-${classFor(layer.id).slice(2)}`;
}

export function compileLayerRules(layers: BackgroundLayer[]): string {
  return visibleLayers(layers).map((layer) => {
    const cls = layerClass(layer);
    let css = `.${cls}{position:absolute;`;
    let inset = 'inset:0';
    let filter = '';
    if (layer.type === 'image') {
      const blur = layer.blur ?? 0;
      const brightness = layer.brightness ?? 1;
      if (blur > 0) {
        filter += `blur(${blur}px)`;
        inset = `inset:-${2 * blur}px`;
      }
      if (brightness !== 1) filter += `brightness(${brightness})`;
    }
    css += `${inset};background:${layerImage(layer)}`;
    if (filter) css += `;filter:${filter}`;
    let opacity = layer.opacity;
    if (layer.type === 'noise') opacity *= layer.intensity ?? 0.15;
    if (opacity < 1) css += `;opacity:${opacity}`;
    if (layer.blendMode !== 'normal') css += `;mix-blend-mode:${layer.blendMode}`;
    css += '}';
    return css;
  }).join('\n');
}

export function blendActive(node: Node): boolean {
  if (!isSectionNode(node)) return false;
  const b = node.sectionBlend;
  if (!b.enabled) return false;
  const top = b.featherTop ?? b.feather;
  const bottom = b.featherBottom ?? b.feather;
  return top > 0 || bottom > 0 || b.overlap > 0;
}

export function usesLayeredPath(node: Node): boolean {
  if (!isPageNode(node) && !isSectionNode(node)) return false;
  const layers = visibleLayers(node.backgroundLayers);
  if (!layers.length) return false;
  return needsLayeredPath(layers) || blendActive(node);
}

export function clampSlideshow(layer: SlideshowLayer): {
  interval: number;
  transition: number;
} {
  const interval = Math.max(2000, layer.interval);
  const transition = Math.min(Math.max(layer.transition ?? 600, 200), interval / 2);
  return { interval, transition };
}

export function defaultLayer(type: BackgroundLayerType): BackgroundLayer {
  const base = {
    id: nanoid(),
    enabled: true,
    opacity: 1,
    blendMode: 'normal',
  } as const;
  switch (type) {
    case 'color':
      return { ...base, type: 'color', color: '#000000' };
    case 'gradient':
      return {
        ...base,
        type: 'gradient',
        angle: 180,
        stops: [
          { offset: 0, color: '#111111' },
          { offset: 100, color: '#333333' },
        ],
      };
    case 'image':
      return { ...base, type: 'image', src: '', size: 'cover', position: 'center', repeat: 'no-repeat' };
    case 'video':
      return { ...base, type: 'video', src: '', loop: true, muted: true, poster: '' };
    case 'noise':
      return { ...base, type: 'noise', intensity: 0.15, scale: 0.8 };
    case 'tint':
      return { ...base, type: 'tint', color: 'rgba(0,0,0,0.4)' };
    case 'slideshow':
      return { ...base, type: 'slideshow', srcs: [], interval: 5000 };
  }
}
