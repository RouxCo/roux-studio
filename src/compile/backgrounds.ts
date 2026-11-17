// src/compile/backgrounds.ts
// Roux Studio — background layer compilation (pure, no React, no DOM).
//
// backgroundLayers[0] is the TOP layer of the stack.
// Fast path: a single `background:` list on the element, visible layers top-first.
// Layered path: an aria-hidden .r-bg div (first child of the page/section) holding
// one .r-bg-layer per visible layer in REVERSE DOM order (bottom layer first).
// The shared .r-bg rule is emitted once in compileBaseStyles (compileStyles.ts),
// not per node.
import type { BackgroundLayer } from '../types';
import { classFor } from './classFor';

const NOISE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
  '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/></filter>' +
  '<rect width="100%" height="100%" filter="url(#n)"/></svg>';

export function visibleLayers(layers: BackgroundLayer[]): BackgroundLayer[] {
  return layers.filter((layer) => layer.enabled !== false);
}

export function needsLayeredPath(layers: BackgroundLayer[]): boolean {
  return visibleLayers(layers).some((layer) =>
    layer.opacity < 1 ||
    layer.blendMode !== 'normal' ||
    layer.type === 'video' ||
    layer.type === 'slideshow' ||
    layer.type === 'noise'
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
      return `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`;
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
    let css = `.${cls}{position:absolute;inset:0;background:${layerImage(layer)}`;
    if (layer.opacity < 1) css += `;opacity:${layer.opacity}`;
    if (layer.blendMode !== 'normal') css += `;mix-blend-mode:${layer.blendMode}`;
    css += '}';
    return css;
  }).join('\n');
}
