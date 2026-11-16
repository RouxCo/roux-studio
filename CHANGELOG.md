# CHANGELOG — Roux Studio

All notable changes to Roux Studio are documented here, per [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — M1 Foundation

### Added
- `src/db/stores.ts` — IndexedDB persistence layer via `idb` 8.x: `projects` store (full project records keyed by project id) and `assets` store (asset blobs keyed by asset id), lazily-opened singleton `getDB()`. Derived helpers `projectSummary()` and `assetRecord()`. IndexedDB used for all project data; no `localStorage`; no base64 inside project JSON (spec §2, §2.2).
- `src/db/broadcast.ts` — BroadcastChannel multi-tab guard (spec §4.7, M1 skeleton): `ProjectBroadcast` announces project saves with a revision, other tabs refresh / offer "Take over"; a tab is read-only until take over. `tabId`, `nextRevision()`, `currentRevision()`, `announce()`, `subscribe()`, `close()`.
- `src/store/useEditorStore.ts` — Zustand + Immer patch-based undo/redo (`produceWithPatches`/`applyPatches`), `HISTORY_CAP = 200`, `beginBatch`/`endBatch` coalescing (one user intent = one step). Tracks project data (nodes, pages, tokens); UI state (breakpoint, selection, zoom) not history-tracked. Multi-tab guard integration (`readOnly`, `remoteRevision`, `takeOver()`).
- `src/types/index.ts` — Core data model: `Node`, `Page`, `DesignTokens`, `Asset`, breakpoints, IDs (spec §4).
- `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/App.css` — Vite + React 19 app shell with Tailwind CSS 4.x (editor chrome only).
- `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — TypeScript 5.7 strict + `noUncheckedIndexedAccess`, project references (`tsc -b`).
- `src/db/stores.test.ts`, `src/db/crud.test.ts`, `src/db/broadcast.test.ts` — Vitest 3.x unit tests with `fake-indexeddb/auto` in Node environment. 24 tests pass.
- `DECISIONS.md`, `CHANGELOG.md` — per spec §17 rule 8.
- `package.json`, `pnpm-workspace.yaml` — pnpm 12 workspace, `allowBuilds: esbuild@0.28.2: true`.

### Changed
- Build tool upgraded to Vite ^8.0.0 (installed 8.3.8) with `@vitejs/plugin-react@^6.1.2`, instead of the Vite 7.x named in spec §2 — current major is 8 and the plugin peer-requires Vite 8 (logged in DECISIONS.md).
- Removed `erasableSyntaxOnly` from `tsconfig.app.json` and `tsconfig.node.json` (TypeScript 5.7 does not support it).
- `broadcast.ts` `tabId` made `readonly public` so tests can assert tab identity.

### Fixed
- `tsc -b` `TS5023` (`erasableSyntaxOnly` unknown in TS 5.7) — removed the option from both tsconfigs.
- `src/db/stores.test.ts` `TS2344`/`TS7006` at lines 7, 61, 74, 108 — `Stores` type alias (`typeof import('./stores')`) plus direct `StoredProject` type import.

### Dev tooling added
- `typescript ~5.7.0`, `vite ^8.0.0`, `@vitejs/plugin-react ^6.1.2`, `tailwindcss ^4.3.5`, `@tailwindcss/vite ^4.3.5`, `vitest ^3.2.7`, `fake-indexeddb ^6.2.8`, `@types/node`, `@types/react`, `@types/react-dom`. Listed in CHANGELOG per spec §2.1 (dev-only tooling must be listed here).

## [M0] — Phase 0 Research

### Added
- `RESEARCH.md` — Phase 0 research: tools used, per-product copy/avoid notes, feature comparison table, Behance/Dribbble inspiration (5–15 linked shots), numbered UX decisions, proposed spec changes.
- `docs/PLAN.md` — M1–M6 milestones, architecture, data flow, risks, exit criteria.
