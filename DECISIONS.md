# DECISIONS.md — Roux Studio

Decisions made during M1 (Foundation), per spec §17 rule 8: **date, decision, alternatives, reason**.
Log any deviation from spec §2 here; ambiguous choices are logged per rule 9.

---

## 2026-11-16 — Build tool: Vite ^8.0.0 (current major 8), not Vite 7.x

**Decision:** Use Vite 8.x (`vite@^8.0.0`, installed 8.3.8) with `@vitejs/plugin-react@^6.1.2`, instead of the Vite 7.x named in spec §2.

**Alternatives:**
- Keep Vite 7.x (`vite@^7.3.8`) and downgrade `@vitejs/plugin-react` to a 6.x build compatible with Vite 7.
- Pin an older `@vitejs/plugin-react` that works with Vite 7 and stay on Vite 7.x.

**Reason:** `@vitejs/plugin-react@6.1.2` peer-requires `vite ^8.0.0`; installing Vite 7 left `vite build` failing with `ERR_PACKAGE_PATH_NOT_EXPORTED ./internal`. Spec §2 says "Use the latest stable release within these major versions… Vite 7.x (or the current major)". The current major is 8, so we use Vite 8 and log the deviation here per spec §2. `pnpm build` and `tsc -b` are now clean (EXIT 0), `dist/` produced.

---

## 2026-11-16 — TypeScript config: removed `erasableSyntaxOnly`

**Decision:** Removed the `erasableSyntaxOnly` compilerOption from `tsconfig.app.json` and `tsconfig.node.json`.

**Alternatives:**
- Leave it and accept `TS5023: Unknown compiler option 'erasableSyntaxOnly'` (TypeScript 5.7 does not support it).
- Upgrade TypeScript to a version that supports it.

**Reason:** The project pins TypeScript `~5.7.0` (spec §2: TypeScript 5.x), which predates `erasableSyntaxOnly`. Removed the line from both configs so `tsc -b` is clean (EXIT 0).

---

## 2026-11-16 — Multi-tab guard: `tabId` made `readonly public`

**Decision:** Changed `tabId` in `src/db/broadcast.ts` from `private readonly` to `readonly public` so tests can compare `notice.tabId` against `b1.tabId`.

**Alternatives:**
- Keep `private` and expose `tabId` through a getter method.
- Add a test-only accessor.

**Reason:** Tests construct `ProjectBroadcast` instances and assert tab identity by reading `.tabId` directly. Making it `readonly public` is the minimal change; the field is still immutable after construction.

---

## 2026-11-16 — Test imports: `Stores` type alias + direct `StoredProject` import

**Decision:** In `src/db/stores.test.ts`, type `Stores = typeof import('./stores')` and import the `StoredProject` type directly from `./stores`.

**Alternatives:**
- Import `StoredProject` through the `Stores` namespace type (`Stores['StoredProject']`).
- Keep the original inline types that caused `TS2344`/`TS7006`.

**Reason:** The original test file referenced module types in ways TypeScript 5.7 rejects under `verbatimModuleSyntax` and strict mode. The alias pattern plus a direct type import resolves `TS2344`/`TS7006` at lines 7, 61, 74, 108 without changing test behaviour. All 24 vitest tests pass.

---

## 2026-11-16 — Project location: `/home/user/Claude-Outbox/projects/roux-studio/`

**Decision:** Build and commit the project at `/home/user/Claude-Outbox/projects/roux-studio/`, not `/home/claude/work/outbox/projects/roux-studio/`.

**Alternatives:**
- Use the sandbox path from the user's CLAUDE.md (`/home/claude/work/outbox/projects/roux-studio/`).

**Reason:** `/home/claude/work` does not exist in this environment; the checked-out project lives at `/home/user/Claude-Outbox/projects/roux-studio/`. All file work, builds and tests run here. Deliverables for the user to open should be copied to `/home/claude/work/outbox/` per CLAUDE.md when a shareable artifact exists.

---

## 2026-11-16 — Persistence: IndexedDB via `idb` 8.x, two stores, Blobs not base64

**Decision:** Store projects in an IndexedDB `projects` store and asset blobs in a separate `assets` store through the `idb` 8.x wrapper (`src/db/stores.ts`), with no `localStorage` for project data and no base64 inside project JSON.

**Alternatives:**
- `localStorage` for projects + base64 assets embedded in project JSON.
- A single store with everything.

**Reason:** Spec §2 explicitly requires `idb` 8.x, bans `localStorage` for project data, and bans base64 inside project JSON (§2.2). The `assets` store keeps blobs out of project JSON so stored projects restore completely. Unit-verified with `fake-indexeddb` (24 tests pass).

---

## 2026-11-16 — Undo/redo: patch-based, cap 200 steps, UI state not tracked

**Decision:** Zustand + Immer `produceWithPatches`/`applyPatches` history (`src/store/useEditorStore.ts`), `HISTORY_CAP = 200`; `beginBatch`/`endBatch` coalesce continuous interactions into one step; UI-only state (breakpoint, selection, zoom) is not history-tracked.

**Alternatives:**
- `zustand/middleware/immer` devtools time-travel.
- Snapshotting the whole project per step.

**Reason:** Spec §2 lists Zustand 5.x + Immer 10.x; §6.4 requires one user intent = one step with batching. Patch-based history is memory-light for a flat nodes map and reversible per step. The cap of 200 bounds memory growth.

Hover/focus-visible compile deferred until a hover field is added to the node types (M4 later job)
---

## 2026-11-16 — compileStyles: nodes passed as 3rd argument, not read from Project

**Decision:** `compileStyles(project, pageId, nodes)` takes the page's node tree as a third argument instead of reading nodes from `Project`, emits compiled CSS only (`c-{hash}` dedupe deferred to M5), no inline `style` attributes.

**Alternatives:**
- Add a `nodes` field to `Project`/`Page` and read it inside `compileStyles`.
- Have `compileStyles(project, pageId)` look nodes up from a global store.

**Reason:** `Project`/`Page` have no `nodes` field — nodes live in `EditorData.nodes` — so the pure function receives the tree as its third argument. This is a small spec deviation logged here per §17 rule 8. Output: `:root` token variables use `--<name>`; base element styles emitted once at the top; one `r-{hash}` rule per node walked in document order, desktop-first; `@media (max-width: 1023px)` and `@media (max-width: 767px)` blocks hold only keys whose resolved value differs (hidden → `display:none` only where it takes effect).
