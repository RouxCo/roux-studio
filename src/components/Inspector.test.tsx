// src/components/Inspector.test.tsx
// Inspector: empty state, per-section rendering, resolved values, override dot,
// one-click reset, and breakpoint resolution (mobile ?? tablet ?? desktop).
//
// Note: React 19 + jsdom does not fire `onChange` for programmatic input events,
// so value *editing* is exercised through the store's patchNode (the same path the
// component's onChange uses) and through the reset-button click (click events do
// fire in this environment).
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import type { BoxNode, Breakpoint, NodeId } from '../types';
import { emptyEditorData } from '../types';
import Inspector from './Inspector';

function box(id: NodeId, styles: Record<string, unknown> = {}): BoxNode {
  return {
    id,
    type: 'box',
    parentId: null,
    children: [],
    styles: styles as never,
    hidden: {},
    locked: false,
  };
}

function renderInspector(
  nodes: Record<NodeId, BoxNode>,
  selection: NodeId[],
  breakpoint: Breakpoint = 'desktop',
) {
  useEditorStore.setState({
    ...emptyEditorData(),
    nodes,
    selection,
    breakpoint,
    zoom: 1,
    readOnly: false,
    remoteRevision: 0,
    history: [],
    historyIndex: -1,
    isBatching: false,
    pendingForward: [],
    pendingInverse: [],
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: ReturnType<typeof createRoot>;
  act(() => {
    root = createRoot(container);
    root.render(<Inspector />);
  });
  return { container, get: () => useEditorStore.getState() };
}

function inputFor(container: HTMLElement, placeholder: string): HTMLInputElement {
  return container.querySelector(`input[placeholder="${placeholder}"]`) as HTMLInputElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Inspector', () => {
  it('shows an empty state when nothing is selected', () => {
    const { container } = renderInspector({}, [], 'desktop');
    expect(container.textContent).toContain('Select a node');
  });

  it('renders the four sections when a node is selected', () => {
    const { container } = renderInspector({ box1: box('box1') }, ['box1'], 'desktop');
    for (const title of ['Layout', 'Typography', 'Colors', 'Spacing']) {
      expect(container.textContent).toContain(title);
    }
  });

  it('displays the resolved value for the active breakpoint', () => {
    const node = box('box1');
    node.styles = { width: { desktop: { kind: 'px', value: 100 } } } as never;
    const { container } = renderInspector({ box1: node }, ['box1'], 'desktop');
    expect(inputFor(container, 'e.g. 100%').value).toBe('100px');
  });

  it('hides the override dot on desktop but shows it on tablet and mobile', () => {
    // Desktop: an override exists but the dot is never shown there.
    const desktopNode = box('box1');
    desktopNode.styles = { width: { desktop: { kind: 'px', value: 200 } } } as never;
    const { container: desktopContainer } = renderInspector({ box1: desktopNode }, ['box1'], 'desktop');
    expect(desktopContainer.querySelector('[title="Override at desktop"]')).toBeNull();

    // Tablet: an override at the active breakpoint shows the dot.
    const tabletNode = box('box1');
    tabletNode.styles = { width: { tablet: { kind: 'px', value: 200 } } } as never;
    const { container: tabletContainer } = renderInspector({ box1: tabletNode }, ['box1'], 'tablet');
    expect(tabletContainer.querySelector('[title="Override at tablet"]')).not.toBeNull();

    // Mobile: same as tablet.
    const mobileNode = box('box1');
    mobileNode.styles = { width: { mobile: { kind: 'px', value: 200 } } } as never;
    const { container: mobileContainer } = renderInspector({ box1: mobileNode }, ['box1'], 'mobile');
    expect(mobileContainer.querySelector('[title="Override at mobile"]')).not.toBeNull();
  });

  it('does not show a dot for a style with no override', () => {
    const { container } = renderInspector({ box1: box('box1') }, ['box1'], 'desktop');
    expect(container.querySelector('[title="Override at desktop"]')).toBeNull();
  });

  it('resets an override back to the base via the reset button', () => {
    // Reset dots/buttons only render on tablet and mobile (never desktop — Fix 4).
    const node = box('box1');
    node.styles = { width: { tablet: { kind: 'px', value: 200 } } } as never;
    const { container, get } = renderInspector({ box1: node }, ['box1'], 'tablet');
    expect(get().nodes['box1']?.styles.width).toEqual({ tablet: { kind: 'px', value: 200 } });

    const reset = container.querySelector('[title="Reset to base"]') as HTMLButtonElement;
    act(() => reset.click());
    expect(get().nodes['box1']?.styles.width).toEqual({});
    expect(container.querySelector('[title="Override at tablet"]')).toBeNull();
  });

  it('resolves the active breakpoint value (mobile ?? tablet ?? desktop)', () => {
    const node = box('box1');
    node.styles = {
      width: { desktop: { kind: 'px', value: 100 }, mobile: { kind: 'px', value: 40 } },
    } as never;
    const { container } = renderInspector({ box1: node }, ['box1'], 'mobile');
    expect(inputFor(container, 'e.g. 100%').value).toBe('40px');
  });

  it('writes a breakpoint override through the store (the onChange path)', () => {
    const { get } = renderInspector({ box1: box('box1') }, ['box1'], 'desktop');
    get().patchNode('box1', (draft) => {
      const styles = draft.styles as unknown as Record<string, Record<string, unknown> | undefined>;
      styles.width = { ...(styles.width ?? {}), desktop: { kind: 'px', value: 200 } };
    });
    expect(get().nodes['box1']?.styles.width).toEqual({ desktop: { kind: 'px', value: 200 } });
  });
});

describe('Inspector: design tokens', () => {
  it('writes a token ref when a token is picked from the dropdown', () => {
    const node = box('box1');
    node.styles = { width: { desktop: { kind: 'px', value: 100 } } } as never;
    const { container, get } = renderInspector({ box1: node }, ['box1'], 'desktop');
    act(() => {
      get().setTokens({
        byName: { 'space-4': { name: 'space-4', value: '1rem', type: 'spacing' } },
      });
    });
    const input = inputFor(container, 'e.g. 100%');
    act(() => {
      input.parentElement!.querySelector<HTMLButtonElement>('button[aria-label="Tokens"]')!.click();
    });
    act(() => {
      const option = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'space-4')!;
      option.click();
    });
    expect(get().nodes['box1']?.styles.width).toEqual({ desktop: { kind: 'token', value: 0, token: 'space-4' } });
    expect(container.querySelector('input[placeholder="e.g. 100%"]')).toBeNull();
    expect(container.textContent).toContain('space-4');
  });

  it('detaches a token ref back to the raw value', () => {
    const node = box('box1');
    node.styles = { width: { desktop: { kind: 'token', value: 0, token: 'space-4' } } } as never;
    const { container, get } = renderInspector({ box1: node }, ['box1'], 'desktop');
    act(() => {
      get().setTokens({
        byName: { 'space-4': { name: 'space-4', value: '1rem', type: 'spacing' } },
      });
    });
    expect(container.querySelector('input[placeholder="e.g. 100%"]')).toBeNull();
    expect(container.textContent).toContain('space-4');
    act(() => {
      const detach = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Detach')!;
      detach.click();
    });
    expect(get().nodes['box1']?.styles.width).toEqual({ desktop: { kind: 'rem', value: 1 } });
    expect(inputFor(container, 'e.g. 100%').value).toBe('1rem');
  });

  it('creates a token from a raw value and undoes both in one step', () => {
    vi.stubGlobal('prompt', () => 'space-8');
    const node = box('box1');
    node.styles = { width: { desktop: { kind: 'px', value: 16 } } } as never;
    const { container, get } = renderInspector({ box1: node }, ['box1'], 'desktop');
    const input = inputFor(container, 'e.g. 100%');
    act(() => {
      input.parentElement!.querySelector<HTMLButtonElement>('button[aria-label="Tokens"]')!.click();
    });
    act(() => {
      const create = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Create token from value…',
      )!;
      create.click();
    });
    expect(get().tokens.byName['space-8']).toEqual({ name: 'space-8', value: '16px', type: 'length' });
    expect(get().nodes['box1']?.styles.width).toEqual({ desktop: { kind: 'token', value: 0, token: 'space-8' } });
    expect(container.querySelector('input[placeholder="e.g. 100%"]')).toBeNull();
    expect(get().canUndo()).toBe(true);
    act(() => {
      get().undo();
    });
    expect(get().tokens.byName).toEqual({});
    expect(get().nodes['box1']?.styles.width).toEqual({ desktop: { kind: 'px', value: 16 } });
    expect(input.value).toBe('16px');
  });
});
