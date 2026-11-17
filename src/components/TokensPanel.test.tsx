// TokensPanel: add, rename, delete-used (detach), invalid-name error.
//
// Note: React 19 + jsdom does not fire onChange for programmatic input events,
// so form *typing* is exercised through the store (the same path the component's
// handlers write to). Click events do work, so the delete flow is tested through
// the UI.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import TokensPanel from './TokensPanel';
import { emptyEditorData } from '../types';

let root!: ReturnType<typeof createRoot>;

function renderPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<TokensPanel />);
  });
  return container;
}

function click(el: HTMLElement) {
  act(() => {
    el.click();
  });
}

function btn(container: HTMLElement, text: string) {
  const el = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.includes(text),
  );
  if (!el) throw new Error(`no button for ${text}`);
  return el as HTMLButtonElement;
}

function deleteButtonOf(container: HTMLElement, name: string) {
  const span = Array.from(container.querySelectorAll('span')).find(
    (s) => s.textContent === name && !s.querySelector('input'),
  );
  if (!span) throw new Error(`no row for ${name}`);
  const row = span.closest('div');
  if (!row) throw new Error(`no row for ${name}`);
  const button = row.querySelector('button');
  if (!button) throw new Error(`no delete button for ${name}`);
  return button as HTMLButtonElement;
}

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  useEditorStore.setState({
    ...emptyEditorData(),
    selection: [],
    clipboard: null,
    history: [],
    historyIndex: -1,
  });
});

describe('TokensPanel', () => {
  it('displays an added token', () => {
    useEditorStore.getState().addToken({
      name: 'color-primary',
      value: '#0f766e',
      type: 'color',
    });
    const container = renderPanel();

    expect(container.textContent).toContain('color-primary');
    expect(useEditorStore.getState().tokens.byName['color-primary']?.value).toBe(
      '#0f766e',
    );
  });

  it('renames a token and refreshes the list', () => {
    useEditorStore.getState().addToken({ name: 'color-primary', value: '#0f766e', type: 'color' });
    const container = renderPanel();
    expect(container.textContent).toContain('color-primary');

    act(() => {
      useEditorStore.getState().renameToken('color-primary', 'color-brand');
    });

    expect(container.textContent).toContain('color-brand');
    expect(container.textContent).not.toContain('color-primary');
    expect(useEditorStore.getState().tokens.byName['color-primary']).toBeUndefined();
    expect(useEditorStore.getState().tokens.byName['color-brand']?.value).toBe('#0f766e');
  });

  it('deleting a used token shows "Used by 1 elements" and Detach removes it', () => {
    const store = useEditorStore.getState();
    store.addToken({ name: 'space-4', value: '1rem', type: 'length' });
    store.addNode(
      {
        id: 'sec-1',
        type: 'section',
        parentId: null,
        children: [],
        styles: {},
        hidden: {},
        locked: false,
        backgroundLayers: [],
        sectionBlend: { enabled: false, feather: 0, overlap: 0 },
      },
      null,
    );
    store.addNode(
      {
        id: 'box-1',
        type: 'box',
        parentId: 'sec-1',
        children: [],
        styles: {},
        hidden: {},
        locked: false,
      },
      'sec-1',
    );
    store.patchNode('box-1', (n) => {
      n.styles = { margin: { desktop: { kind: 'token', value: 0, token: 'space-4' } } };
    });
    const container = renderPanel();

    click(deleteButtonOf(container, 'space-4'));
    expect(container.textContent).toContain('Used by 1 elements');

    click(btn(container, 'Detach & delete'));

    expect(useEditorStore.getState().tokens.byName['space-4']).toBeUndefined();
    expect(container.textContent).not.toContain('space-4');
  });

  it('shows an error for an invalid name and does not add the token', () => {
    const container = renderPanel();
    click(btn(container, 'Add token'));
    click(btn(container, 'Add'));

    expect(container.textContent).toContain('kebab-case');
    expect(useEditorStore.getState().tokens.byName).toEqual({});
  });
});
