// src/store/layers.test.ts
// Store actions for background layers (M4 Job 4, step 2): add/update/remove/
// duplicate/move/toggle — each one undo step. No UI yet.
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { useEditorStore } from './useEditorStore';
import type {
  BackgroundLayer, BoxNode, ColorLayer, GradientLayer, ImageLayer, NoiseLayer, NodeId, PageId, PageNode, Project, SectionNode,
} from '../types';
import { emptyEditorData } from '../types';
import { compileStyles } from '../compile/compileStyles';
import { layerClass } from '../compile/backgrounds';

const get = () => useEditorStore.getState();

const COLOR: BackgroundLayer = {
  id: 'bg-color', type: 'color', enabled: true, opacity: 1, blendMode: 'normal', color: '#ff0000',
};
const HALF: BackgroundLayer = { ...COLOR, id: 'bg-half', opacity: 0.5 };
const GRAD: BackgroundLayer = {
  id: 'bg-grad', type: 'gradient', enabled: true, opacity: 1, blendMode: 'normal',
  angle: 45, stops: [{ offset: 0, color: '#0000ff' }, { offset: 100, color: '#ffffff' }],
};

function box(id: NodeId): BoxNode {
  return {
    id, type: 'box', parentId: null, children: [], styles: {}, hidden: {}, locked: false,
  };
}

function section(id: NodeId, layers: BackgroundLayer[] = []): SectionNode {
  return {
    id, type: 'section', parentId: null, children: [], styles: {}, hidden: {}, locked: false,
    backgroundLayers: layers, sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  };
}

function page(id: NodeId, layers: BackgroundLayer[] = []): PageNode {
  return {
    id, type: 'page', parentId: null, children: [], styles: {}, hidden: {}, locked: false,
    title: 'Home', slug: 'home', backgroundLayers: layers,
  };
}

function secLayers(id: NodeId): BackgroundLayer[] {
  return (get().nodes[id] as SectionNode).backgroundLayers;
}

const PROJECT: Project = {
  id: 'proj-1', name: 'Roux Studio',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  pages: [{ id: 'pg-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
  tokens: { byName: {} },
};

function storeCss(): string {
  return compileStyles(PROJECT, 'pg-1' as PageId, get().nodes);
}

beforeEach(() => {
  useEditorStore.setState({
    ...emptyEditorData(),
    zoom: 1,
    readOnly: false,
    remoteRevision: 0,
    history: [],
    historyIndex: -1,
    isBatching: false,
    pendingForward: [],
    pendingInverse: [],
    clipboard: null,
  });
});

describe('addLayer', () => {
  it('inserts the default layer at index 0, above existing layers', () => {
    get().addNode(section('sec-1', [COLOR, GRAD]), null);
    get().addLayer('sec-1', 'image');

    const layers = secLayers('sec-1');
    expect(layers).toHaveLength(3);
    const top = layers[0]!;
    expect(top.type).toBe('image');
    const image = top as ImageLayer;
    expect(image.enabled).toBe(true);
    expect(image.opacity).toBe(1);
    expect(image.blendMode).toBe('normal');
    expect(image.src).toBe('');
    expect(image.size).toBe('cover');
    expect(image.position).toBe('center');
    expect(image.repeat).toBe('no-repeat');
    expect(layers[1]).toBe(COLOR);
    expect(layers[2]).toBe(GRAD);
  });

  it('is a true no-op on a node without backgroundLayers', () => {
    useEditorStore.setState((s) => ({ nodes: { ...s.nodes, 'box-1': box('box-1') } }));
    get().addLayer('box-1', 'image');
    expect(get().canUndo()).toBe(false);
    expect(get().history).toHaveLength(0);
    expect(get().nodes['box-1']).toEqual(box('box-1'));
  });

  it('is exactly one undo step', () => {
    get().addNode(section('sec-1'), null);
    useEditorStore.setState({ history: [], historyIndex: -1 });
    get().addLayer('sec-1', 'noise');

    expect(get().history).toHaveLength(1);
    const layer = secLayers('sec-1')[0]!;
    expect(layer.type).toBe('noise');
    const noise = layer as NoiseLayer;
    expect(noise.intensity).toBe(0.15);
    expect(noise.scale).toBe(0.8);

    get().undo();
    expect(secLayers('sec-1')).toHaveLength(0);
    expect(get().historyIndex).toBe(-1);
    expect(get().canUndo()).toBe(false);
  });
});

describe('updateLayer', () => {
  it('merges the patch into the existing layer', () => {
    get().addNode(section('sec-1', [COLOR]), null);
    get().updateLayer('sec-1', COLOR.id, { opacity: 0.5, name: 'Header' });

    const layer = secLayers('sec-1')[0]!;
    expect(layer.id).toBe(COLOR.id);
    expect(layer.opacity).toBe(0.5);
    expect(layer.name).toBe('Header');
    const colored = layer as ColorLayer;
    expect(colored.color).toBe('#ff0000');
  });

  it('leaves the store untouched for an unknown layer id', () => {
    get().addNode(section('sec-1', [COLOR]), null);
    get().updateLayer('sec-1', 'nope', { opacity: 0.5 });
    expect(secLayers('sec-1')).toEqual([COLOR]);
  });
});

describe('removeLayer', () => {
  it('removes the layer by id and keeps the order of the rest', () => {
    get().addNode(section('sec-1', [COLOR, GRAD]), null);
    get().removeLayer('sec-1', COLOR.id);

    const layers = secLayers('sec-1');
    expect(layers).toHaveLength(1);
    expect(layers[0]!.id).toBe(GRAD.id);
  });

  it('is exactly one undo step', () => {
    get().addNode(section('sec-1', [COLOR]), null);
    useEditorStore.setState({ history: [], historyIndex: -1 });
    get().removeLayer('sec-1', COLOR.id);
    expect(get().history).toHaveLength(1);

    get().undo();
    expect(secLayers('sec-1')).toEqual([COLOR]);
    expect(get().canUndo()).toBe(false);
  });
});

describe('duplicateLayer', () => {
  it('inserts a copy with a new id directly above the original', () => {
    get().addNode(section('sec-1', [COLOR, GRAD]), null);
    get().duplicateLayer('sec-1', GRAD.id);

    const layers = secLayers('sec-1');
    expect(layers).toHaveLength(3);
    expect(layers[0]!.id).toBe(COLOR.id);
    const copy = layers[1]!;
    expect(copy.id).not.toBe(GRAD.id);
    expect(copy.type).toBe('gradient');
    expect(copy.name).toBe('gradient copy');
    const gradCopy = copy as GradientLayer;
    expect(gradCopy.angle).toBe(45);
    expect(layers[2]!.id).toBe(GRAD.id);
  });

  it('names the copy after the layer name when one is set', () => {
    get().addNode(section('sec-1', [{ ...COLOR, name: 'Header' }]), null);
    get().duplicateLayer('sec-1', COLOR.id);
    expect(secLayers('sec-1')[0]!.name).toBe('Header copy');
  });
});

describe('moveLayer', () => {
  it('reorders layers', () => {
    const A: BackgroundLayer = { ...COLOR, id: 'a', color: '#ff0000' };
    const B: BackgroundLayer = { ...COLOR, id: 'b', color: '#0000ff' };
    const C: BackgroundLayer = { ...COLOR, id: 'c', color: '#00ff00' };
    get().addNode(section('sec-1', [A, B, C]), null);
    get().moveLayer('sec-1', 0, 2);

    const ids = secLayers('sec-1').map((l) => l.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('clamps a move past the end to the last position', () => {
    get().addNode(section('sec-1', [COLOR, GRAD]), null);
    get().moveLayer('sec-1', 0, 9);
    const ids = secLayers('sec-1').map((l) => l.id);
    expect(ids).toEqual([GRAD.id, COLOR.id]);
  });

  it('restores the order with one undo', () => {
    get().addNode(section('sec-1', [COLOR, GRAD]), null);
    useEditorStore.setState({ history: [], historyIndex: -1 });
    get().moveLayer('sec-1', 1, 0);
    expect(get().history).toHaveLength(1);

    get().undo();
    expect(secLayers('sec-1').map((l) => l.id)).toEqual([
      COLOR.id,
      GRAD.id,
    ]);
  });
});

describe('toggleLayer', () => {
  it('hides the layer and removes it from compiled styles', () => {
    useEditorStore.setState((s) => ({
      nodes: { ...s.nodes, 'page-1': page('page-1', [HALF]) },
    }));
    const cls = layerClass(HALF);
    expect(storeCss()).toContain(cls);
    get().toggleLayer('page-1', HALF.id);

    expect((get().nodes['page-1'] as PageNode).backgroundLayers[0]!.enabled).toBe(false);
    expect(storeCss()).not.toContain(cls);
  });

  it('restores the layer when toggled back on', () => {
    useEditorStore.setState((s) => ({
      nodes: { ...s.nodes, 'page-1': page('page-1', [HALF]) },
    }));
    const cls = layerClass(HALF);
    get().toggleLayer('page-1', HALF.id);
    get().toggleLayer('page-1', HALF.id);

    expect((get().nodes['page-1'] as PageNode).backgroundLayers[0]!.enabled).toBe(true);
    expect(storeCss()).toContain(cls);
  });

  it('is exactly one undo step', () => {
    useEditorStore.setState((s) => ({
      nodes: { ...s.nodes, 'page-1': page('page-1', [HALF]) },
    }));
    useEditorStore.setState({ history: [], historyIndex: -1 });
    get().toggleLayer('page-1', HALF.id);
    expect(get().history).toHaveLength(1);

    get().undo();
    expect((get().nodes['page-1'] as PageNode).backgroundLayers[0]!.enabled).toBe(true);
    expect(get().historyIndex).toBe(-1);
  });
});

describe('blendWithPrevious', () => {
  it('sets overlap and featherTop on this section in ONE undo step', () => {
    useEditorStore.setState((s) => ({
      nodes: { ...s.nodes, 'page-1': page('page-1') },
    }));
    get().addNode(section('sec-1'), 'page-1');
    get().addNode(section('sec-2'), 'page-1');
    useEditorStore.setState({ history: [], historyIndex: -1 });
    get().blendWithPrevious('sec-2');

    expect(get().history).toHaveLength(1);
    const blend = (get().nodes['sec-2'] as SectionNode).sectionBlend;
    expect(blend.enabled).toBe(true);
    expect(blend.overlap).toBe(120);
    expect(blend.featherTop).toBe(120);
    expect(blend.featherBottom).toBeUndefined();

    get().undo();
    expect((get().nodes['sec-2'] as SectionNode).sectionBlend).toEqual({
      enabled: false, feather: 0, overlap: 0,
    });
    expect(get().historyIndex).toBe(-1);
    expect(get().canUndo()).toBe(false);
  });

  it('is a no-op when there is no previous section', () => {
    useEditorStore.setState((s) => ({
      nodes: { ...s.nodes, 'page-1': page('page-1') },
    }));
    get().addNode(section('sec-1'), 'page-1');
    useEditorStore.setState({ history: [], historyIndex: -1 });
    get().blendWithPrevious('sec-1');
    expect(get().history).toHaveLength(0);
    expect(get().canUndo()).toBe(false);
  });
});

describe('blendWithNext', () => {
  it('changes both sections and one undo restores both', () => {
    useEditorStore.setState((s) => ({
      nodes: { ...s.nodes, 'page-1': page('page-1') },
    }));
    get().addNode(section('sec-1'), 'page-1');
    get().addNode(section('sec-2'), 'page-1');
    useEditorStore.setState({ history: [], historyIndex: -1 });
    get().blendWithNext('sec-1');

    expect(get().history).toHaveLength(1);
    const first = (get().nodes['sec-1'] as SectionNode).sectionBlend;
    const second = (get().nodes['sec-2'] as SectionNode).sectionBlend;
    expect(first.enabled).toBe(true);
    expect(first.featherBottom).toBe(120);
    expect(first.overlap).toBe(0);
    expect(second.enabled).toBe(true);
    expect(second.overlap).toBe(120);
    expect(second.featherTop).toBe(120);

    get().undo();
    expect((get().nodes['sec-1'] as SectionNode).sectionBlend).toEqual({
      enabled: false, feather: 0, overlap: 0,
    });
    expect((get().nodes['sec-2'] as SectionNode).sectionBlend).toEqual({
      enabled: false, feather: 0, overlap: 0,
    });
    expect(get().historyIndex).toBe(-1);
  });

  it('is a no-op when there is no next section', () => {
    useEditorStore.setState((s) => ({
      nodes: { ...s.nodes, 'page-1': page('page-1') },
    }));
    get().addNode(section('sec-1'), 'page-1');
    useEditorStore.setState({ history: [], historyIndex: -1 });
    get().blendWithNext('sec-1');
    expect(get().history).toHaveLength(0);
  });
});

describe('clearBlend', () => {
  it('resets the blend and drops featherTop/featherBottom in ONE undo step', () => {
    useEditorStore.setState((s) => ({
      nodes: { ...s.nodes, 'page-1': page('page-1') },
    }));
    get().addNode(section('sec-1'), 'page-1');
    get().addNode(section('sec-2'), 'page-1');
    get().blendWithNext('sec-1');
    useEditorStore.setState({ history: [], historyIndex: -1 });
    get().clearBlend('sec-2');

    expect(get().history).toHaveLength(1);
    const blend = (get().nodes['sec-2'] as SectionNode).sectionBlend;
    expect(blend).toEqual({ enabled: false, feather: 0, overlap: 0 });
    expect(blend.featherTop).toBeUndefined();
    expect(blend.featherBottom).toBeUndefined();

    get().undo();
    expect((get().nodes['sec-2'] as SectionNode).sectionBlend.featherTop).toBe(120);
    expect(get().historyIndex).toBe(-1);
  });
});
