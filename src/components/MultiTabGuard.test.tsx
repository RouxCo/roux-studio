// src/components/MultiTabGuard.test.tsx
// MultiTabGuard: take-over banner when another tab saved a newer revision.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import { emptyEditorData } from '../types';
import MultiTabGuard from './MultiTabGuard';

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: ReturnType<typeof createRoot>;
  act(() => {
    root = createRoot(container);
    root.render(<MultiTabGuard />);
  });
  return container;
}

beforeEach(() => {
  useEditorStore.setState({
    ...emptyEditorData(),
    readOnly: false,
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('MultiTabGuard', () => {
  it('renders nothing when the tab is not read-only', () => {
    const container = mount();
    expect(container.children).toHaveLength(0);
  });

  it('shows the take-over banner when another tab saved', () => {
    useEditorStore.setState({ readOnly: true, remoteRevision: 3 });
    const container = mount();
    expect(container.children).toHaveLength(1);
    expect(container.textContent).toContain('read-only');
    expect(container.textContent).toContain('revision');
    expect(container.textContent).toContain('Take over');
    expect(container.textContent).toContain('Reload');
  });

  it('Take over clears read-only and dismisses the banner', () => {
    useEditorStore.setState({ projectId: 'proj-1', readOnly: true, remoteRevision: 3 });
    const container = mount();
    const takeOverBtn = container.querySelectorAll<HTMLElement>('button')[0]!;
    act(() => {
      takeOverBtn.click();
    });
    expect(useEditorStore.getState().readOnly).toBe(false);
    expect(container.children).toHaveLength(0);
  });

  it('Reload calls window.location.reload', () => {
    const mockReload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({ ...originalLocation, reload: mockReload }),
    });
    try {
      useEditorStore.setState({ readOnly: true });
      const container = mount();
      const reloadBtn = container.querySelectorAll<HTMLElement>('button')[1]!;
      act(() => {
        reloadBtn.click();
      });
      expect(mockReload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
