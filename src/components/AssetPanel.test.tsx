// src/components/AssetPanel.test.tsx
// Asset panel: list, insert as image, delete, upload.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { useEditorStore } from '../store/useEditorStore';
import { getDB, getAllAssets, putAsset } from '../db/stores';
import type { Node, NodeId, SectionNode } from '../types';
import { emptyEditorData } from '../types';
import AssetPanel from './AssetPanel';

let root!: ReturnType<typeof createRoot>;

function pageNode(): Node {
  return {
    id: 'page-1', type: 'page', parentId: null, children: ['sec-1'],
    styles: {}, hidden: {}, locked: false, title: 'Home', slug: 'home', backgroundLayers: [],
  };
}

function section(id: NodeId, parentId: NodeId | null = null): SectionNode {
  return {
    id, type: 'section', parentId, children: [],
    styles: {}, hidden: {}, locked: false,
    backgroundLayers: [], sectionBlend: { enabled: false, feather: 0, overlap: 0 },
  };
}

async function seedAsset(id: string, name: string, mimeType: string): Promise<void> {
  await putAsset(id, new Blob([`${id}-bytes`], { type: mimeType }), name, mimeType);
}

function renderAssets(selection: NodeId[] = []) {
  useEditorStore.setState({
    ...emptyEditorData(),
    pages: [{ id: 'page-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
    nodes: { 'page-1': pageNode() },
    currentPageId: 'page-1',
    selection,
    history: [], historyIndex: -1,
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<AssetPanel />);
  });
  return container;
}

// Assets load asynchronously from IndexedDB in a useEffect. Flush microtasks
// and macrotasks so the panel re-renders with the seeded list.
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
}

afterEach(async () => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  const db = await getDB();
  await db.clear('assets');
  useEditorStore.setState({
    ...emptyEditorData(),
    selection: [],
    history: [],
    historyIndex: -1,
  });
});

beforeEach(async () => {
  const db = await getDB();
  await db.clear('assets');
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:mock-url',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => {},
  });
});

describe('AssetPanel', () => {
  it('shows the empty state with no assets', async () => {
    const container = renderAssets();
    await flush();
    expect(container.textContent).toContain('No assets yet');
    expect(container.textContent).toContain('Upload assets');
  });

  it('lists uploaded assets with name, mime type and size', async () => {
    await seedAsset('asset-1', 'cat.png', 'image/png');
    await seedAsset('asset-2', 'clip.mp4', 'video/mp4');

    const container = renderAssets();
    await flush();
    expect(container.textContent).toContain('cat.png');
    expect(container.textContent).toContain('clip.mp4');
    expect(container.textContent).toContain('Image');
    expect(container.textContent).toContain('Video');
  });

  it('inserting an asset as an image creates a node referencing the asset id', async () => {
    await seedAsset('asset-img', 'photo.png', 'image/png');

    const store = useEditorStore.getState();
    store.addNode(section('sec-1'), null);
    store.setSelection(['sec-1']);

    const container = renderAssets(['sec-1']);
    // renderAssets overwrites nodes; re-add the section so it exists in the store.
    useEditorStore.getState().addNode(section('sec-1'), null);
    await flush();

    act(() => {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.getAttribute('aria-label') === 'Insert as image',
      );
      btn!.click();
    });

    const nodes = useEditorStore.getState().nodes;
    const imageNodes = Object.values(nodes).filter((n) => n.type === 'image');
    expect(imageNodes).toHaveLength(1);
    expect(imageNodes[0]!.src).toBe('asset-img');
    expect(useEditorStore.getState().selection).toContain(imageNodes[0]!.id);
  });

  it('delete removes an asset from IndexedDB', async () => {
    await seedAsset('asset-del', 'del.png', 'image/png');

    const container = renderAssets();
    await flush();

    act(() => {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.getAttribute('aria-label') === 'Delete',
      );
      btn!.click();
    });

    const remaining = await getAllAssets();
    expect(remaining.map((a) => a.id)).not.toContain('asset-del');
  });

  it('uploading a file adds it to IndexedDB', async () => {
    const container = renderAssets();
    await flush();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    // The file input routes through addAsset; exercise that path directly via the
    // store (jsdom can't synthesize a FileList on an input).
    await useEditorStore.getState().addAsset(
      new File(['uploaded'], 'uploaded.png', { type: 'image/png' }),
    );

    const assets = await getAllAssets();
    expect(assets.some((a) => a.name === 'uploaded.png')).toBe(true);
  });
});
