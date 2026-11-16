import { defineConfig } from 'vitest/config'

// Roux Studio unit tests run in Node with fake-indexeddb standing in for
// IndexedDB and a worker_threads BroadcastChannel shim for the multi-tab guard.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
})
