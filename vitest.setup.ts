// vitest.setup.ts — polyfills for the jsdom test environment.
//
// The editor store imports the BroadcastChannel-based multi-tab guard, which
// Node provides natively but jsdom does not. Polyfill it here so store-backed
// components (e.g. SelectionOverlay) can be imported under jsdom.
class BroadcastChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
  close(): void {}
}

if (typeof globalThis.BroadcastChannel === 'undefined') {
  globalThis.BroadcastChannel = BroadcastChannel as unknown as typeof globalThis.BroadcastChannel;
}

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = { randomUUID: () => '00000000-0000-4000-0000-000000000000' } as unknown as Crypto;
} else if (typeof (globalThis.crypto as Crypto).randomUUID !== 'function') {
  (globalThis.crypto as any).randomUUID = () => '00000000-0000-4000-0000-000000000000';
}
