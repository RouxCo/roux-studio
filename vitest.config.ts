import { defineConfig } from 'vitest/config'

// Roux Studio unit tests run in jsdom so store-backed components that touch the
// DOM (SelectionOverlay, inline contentEditable editing) can be mounted. A
// BroadcastChannel / crypto.randomUUID polyfill is provided in vitest.setup.ts
// because jsdom does not implement them (Node does).
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
