# PLAN.md — Roux Studio Phase 0 Plan

**Client:** Roux and Co. (South African web design agency)
**Product:** Roux Studio — local-first, browser-based visual website builder exporting clean static sites
**Date:** 2026-11-15
**Status:** Draft — awaiting owner approval together with `research/RESEARCH.md` before any app code is written (spec §0.7 hard gate).

---

## 1. Purpose and scope

This plan folds the research decisions in `research/RESEARCH.md` into the build plan for Roux Studio. It covers: architecture summary, data flow, the numbered UX decisions adopted from research, key risks, and the M1–M6 milestone breakdown with estimated sub-tasks.

**In scope:** everything in the build spec sections 0–18 — the editor shell, canvas renderer, element registry, style compiler, responsive breakpoints, background layer stack, design tokens, blocks, templates, undo/redo, IndexedDB storage, `.roux.zip` import/export, static export pipeline, pre-export checks, multi-tab safety, and the test suite (Vitest + Playwright).

**Out of scope:** production deployment (only previews unless the owner says `--prod`), ecommerce/shopping-cart features, user accounts or cloud sync, CMS/back-end, any Framer Motion or React in exported sites, proprietary hosting lock-in.

---

## 2. Source of truth

- Build spec: `/home/user/Downloads/website-builder-claude-code-prompt1.md` (sections 0–18)
- Research decisions: `/home/claude/work/outbox/projects/roux-studio/research/RESEARCH.md`
- Repo root: `/home/claude/work/outbox/projects/roux-studio/` (commit `68d1010`, `main` branch)
- `research/` is git-ignored — raw source URLs and third-party analysis live there only; nothing from it ships in the app.

---

## 3. Research decisions adopted (referenced by number)

All twelve numbered UX decisions from `RESEARCH.md` §5 are adopted as binding design constraints:

1. **Three-pane editor shell** — left Layers tree, centre iframe canvas, right Inspector ([Webflow Navigator + Style panel; Elementor panel+preview]).
2. **Per-breakpoint overrides with visual indicators** — desktop-first 1440 / 768 / 390, indicators show which breakpoints have overrides, one-click reset ([Webflow breakpoint controls; Framer responsive constraints]).
3. **Background layer stack, list top = front layer** — add/reorder/duplicate/rename/hide/delete ([spec §8.1; Wix section backgrounds]).
4. **Feathered section blending via background wrapper only** — `mask-image` on `.r-bg` wrapper, overlap via `top: -Npx`, sections `overflow: visible` ([spec §8.2]).
5. **Template-first project creation** — four starter templates + blank; project list offers template or blank at creation ([Canva Websites]).
6. **Sections + Blocks reuse model** — save configured selection as a block, insert into any page; global header/footer as special blocks ([Shopify sections/blocks]).
7. **Global design tokens with references** — token panel, `var(--color-primary)` references, detach/promote, deletion handling ([spec §4/§5.3; Shopify global theme settings; Webflow styles]).
8. **Clean static export, no editor artefacts** — no inline styles, no `data-node-id`, no Tailwind classes, vanilla JS `<8KB gzipped`, `defer` ([spec §11]; every incumbent ties output to proprietary hosting).
9. **Click-to-load video/slideshow facades** — poster + play button, lazy-load `src` within 200% viewport, pause offscreen ([spec §8.3/§8.4]).
10. **Multi-tab safety via BroadcastChannel + revision** — read-only unless "Take over", conflict dialog on save ([spec §12]).
11. **Pre-export checks grouped Errors/Warnings with click-to-select** ([spec §11.5]).
12. **Copy uses "we" not "I"; avoid-ai-writing on all copy** — SA business copy, no lorem ipsum, no real names/numbers ([CLAUDE.md; spec §13]).

Accepted spec changes (owner-approved, 2026-11-16): visible "Publish to" host choice in export; template thumbnail generation; Blocks as its own left-panel tab. See `RESEARCH.md` §6.

---

## 4. Architecture summary

### 4.1 Tech stack (spec §2)

TypeScript 5.x (strict, `noUncheckedIndexedAccess`), React 19, Vite 8, pnpm 12, Zustand 5.x + Immer 10.x, `@dnd-kit/core` 6.x + `@dnd-kit/sortable`, `idb` 8.x (IndexedDB), `JSZip` 3.x, `react-colorful` 5.x, `culori` 4.x, `lucide-react`, Tailwind CSS 4.x (editor chrome only), Radix UI primitives, `nanoid` 5.x, Canvas/OffscreenCanvas + `createImageBitmap`, Tiptap 2.x/3.x (restricted rich text), Vitest 3.x + `@testing-library/react` + `fake-indexeddb`, Playwright 1.x (Chromium), ESLint 9 flat + Prettier 3.

Exported animations = plain CSS + vanilla JS runtime (IntersectionObserver), `<8KB` gzipped `site.js`, `defer`, no React/Framer Motion in exports. Framer Motion optional in editor UI only.

### 4.2 Data model (spec §4)

- Flat `nodes` map keyed by ID + `children` ID arrays + `parentId` (no nesting in the map itself).
- `ResponsiveStyles` desktop-first: `mobile ?? tablet ?? desktop` fallback per key.
- `BackgroundLayer` stack: color / gradient / image / video / noise / tint / slideshow, each with `opacity` + `blendMode`.
- `SectionBlend` feathering + overlap controls.
- `DesignTokens` with named references (`var(--color-primary)`).
- Assets stored as Blobs in a separate IndexedDB store — no base64 in project JSON.

### 4.3 Style compiler (spec §5.3)

- Desktop-first; tablet → `@media (max-width: 1023px)`, mobile → `@media (max-width: 767px)`.
- `resolveStyle(node, bp, key)`; classes `r-{shortHash}`; dedupe `c-{hash}` classes; token refs → `var(--...)`; `Length {kind:'token'}` → `var(--space-4)`; max 3 decimals; hidden per breakpoint → `display:none`.
- `compileStyles(project, pageId)` is a pure function, fully unit-tested.

### 4.4 Canvas (spec §5.1)

- Same-origin iframe, `srcdoc` bootstrap; width = active breakpoint (1440 / 768 / 390); CSS `transform: scale()` zoom.
- Editor Tailwind is NOT inside the iframe.
- Selection outlines + resize handles drawn in the editor-document overlay via `getBoundingClientRect()`.
- `data-node-id` for hit-testing (omitted in export).
- One renderer: `renderNode(node, ctx)` used by both the canvas (React portal into `iframe.contentDocument.body`) and export (`react-dom/server` `renderToStaticMarkup` with `ctx.mode = 'export'`).

### 4.5 Undo/redo (spec §6.4)

- Immer patches (forward + inverse), cap 200 steps, one user intent = one step.
- Continuous interactions coalesced on pointer-up; typing coalesces until blur or 1s idle; multi-node ops one step.
- Selection / zoom / panel / breakpoint are not history steps; asset blob uploads are not undone; orphan blobs collected on "Clean unused assets" with confirmation only.

### 4.6 Containment (spec §7.1)

- Page root contains sections / nav / footer / componentInstance.
- Section contains anything except section / nav / footer.
- Nav / footer contain container / link / button / image / icon / richText / paragraph.
- Form contains formField / button / paragraph / heading.
- FAQ contains faqItem only; slider / gallery contain slides or image items; pricingTable contains cards.
- Enforced on add / paste / move.

### 4.7 Storage and import/export

- IndexedDB via `idb`: `projects` store + separate `assets` blob store.
- Import/export as `.roux.zip` via `JSZip` (projects JSON + asset blobs).
- Multi-tab: `BroadcastChannel` + document revision; read-only unless "Take over"; conflict dialog on save.

---

## 5. Data flow

**Editor session (live):**
1. User edits in the Inspector / canvas → Zustand + Immer store records one patch step (undo/redo).
2. `compileStyles(project, pageId)` runs → CSS module with `r-{hash}` classes and breakpoint media queries.
3. `renderNode(node, ctx)` with `ctx.mode = 'edit'` renders into the iframe canvas via React portal; editor overlay draws selection/resize handles from `getBoundingClientRect()`.
4. Store persists to IndexedDB on change; `BroadcastChannel` notifies other tabs.

**Export (static):**
1. Pre-export checks run (Errors / Warnings grouped, click-to-select).
2. `renderNode(node, ctx)` with `ctx.mode = 'export'` → `renderToStaticMarkup` → HTML per page.
3. Compiled CSS bundled into one `.css` file; vanilla JS runtime (`<8KB` gzipped, `defer`) handles IntersectionObserver animations and click-to-load video/slideshow facades.
4. Assets (images, video, fonts) copied as files; no `data-node-id`, no inline styles, no Tailwind classes.
5. Output zipped via `JSZip` as a deploy-ready static folder (Cloudflare Pages / Netlify / Vercel) or downloaded as `.zip`.

---

## 6. Key risks

| Risk | Mitigation |
|------|-----------|
| One renderer correct across live canvas (scaled, interactive) and static export (no `data-node-id`) | Shared `renderNode` with dual-mode unit tests (canvas + export) |
| Breakpoint override resolution (`mobile ?? tablet ?? desktop`) correctness | `compileStyles` pure function with full resolution matrix unit-tested |
| IndexedDB quota / blob storage limits for assets | Per-asset size limits + "Clean unused assets" orphan collection with confirmation |
| Export animation runtime under 8KB gzipped | Vanilla JS only; size-budget test in CI |
| Multi-tab conflict UX complexity | Simple revision + `BroadcastChannel`; clear "Take over" / conflict dialog |
| Keeping exported output free of editor artefacts | Export-mode unit tests assert no inline styles / `data-node-id` / Tailwind classes |

---

## 7. Milestones M1–M6

### M1 — Scaffold + data model + store (~1.5–2 weeks)

- Vite 8 + React 19 + TypeScript strict + Tailwind 4 scaffold, pnpm 12
- Zustand + Immer store with patch-based undo/redo (cap 200)
- Nodes schema: flat map + `children` arrays + `parentId`; element base schema per spec §4
- `ResponsiveStyles`, `BackgroundLayer`, `SectionBlend`, `DesignTokens` types
- IndexedDB stores via `idb`: `projects` + separate `assets` blob store
- Project CRUD: new (template / blank), open, save, rename, delete
- `BroadcastChannel` multi-tab guard skeleton
- Tests: store + schema unit tests (Vitest + `fake-indexeddb`)

### M2 — Canvas renderer + element registry (~2 weeks)

- `renderNode(node, ctx)` pure renderer (canvas + export modes)
- Iframe canvas: same-origin `srcdoc`, width per active breakpoint, `transform: scale()` zoom; editor Tailwind excluded from iframe
- Element registry: section, container, box, heading, paragraph, richText, button, link, image, icon, form, formField, faq, faqItem, slider, slide, gallery, imageItem, pricingTable, card, nav, footer, componentInstance
- Containment rules enforced on add / paste / move
- Selection outlines + resize handles overlay via `getBoundingClientRect()`; `data-node-id` hit-testing
- Canvas click / select; double-click inline text edit
- Unit tests for `renderNode` in both modes

### M3 — Editor shell + interactions (~2 weeks)

- Left panel with two tabs: Layers (navigator tree) and Blocks; centre canvas; right Inspector
- Inspector panel sections: Layout, Typography, Colors, Background, Effects, Responsive
- Breakpoint toggles 1440 / 768 / 390 with override indicators + one-click reset
- `@dnd-kit` insert from insert menu onto canvas; reorder in Layers tree; move between parents respecting containment
- Resize handles + move via pointer events; multi-select; delete; undo/redo toolbar
- Context menus; copy / paste
- Restricted Tiptap rich-text inline editing

### M4 — Responsive + styles + blocks + templates (~2 weeks)

- `compileStyles(project, pageId)` pure function: desktop-first, `r-{hash}` classes, `c-{hash}` dedupe, token refs → `var(--...)`, max 3 decimals, hidden → `display:none`
- Design tokens panel: create / reference / detach / promote; deletion rules
- Background layer stack editor (color / gradient / image / video / noise / tint / slideshow), `opacity` + `blendMode`; reorder / hide / delete
- Section blend feathering + overlap controls (`mask-image` on `.r-bg` wrapper; `top: -Npx` overlap)
- Blocks: save configured selection as a block; insert block into any page; global header/footer as special blocks
- Four complete South African business starter templates, each with its own set of pages (not a single home/about/services/contact split), with SA business copy via copywriter — no lorem ipsum, no real names/numbers
- Template or blank project creation flow

### M5 — Export pipeline + pre-export checks (~1–1.5 weeks)

- Export: one HTML per page + one CSS + minimal vanilla JS (`<8KB` gzipped, `defer`) + assets
- No inline styles, no `data-node-id`, no Tailwind classes in export
- `react-dom/server` `renderToStaticMarkup` with `ctx.mode = 'export'`
- Vanilla JS runtime: IntersectionObserver animations; click-to-load video/slideshow facades (poster + play, lazy `src` within 200% viewport, pause offscreen)
- `.zip` output via `JSZip` + folder export; deploy-ready static output with per-host instructions (Cloudflare Pages / Netlify / Vercel)
- Pre-export checks: Errors / Warnings grouped, click-to-select (spec §11.5)

### M6 — Import/export + multi-tab + polish (~1–1.5 weeks)

- `.roux.zip` import/export (projects JSON + asset blobs)
- Multi-tab safety: `BroadcastChannel` + revision; read-only unless "Take over"; conflict dialog
- Asset manager: upload, insert, "Clean unused assets" orphan collection with confirmation
- Publish-to guidance per host
- Polish: empty states, keyboard shortcuts, tooltips, accessibility
- Final QA: Vitest + React Testing Library unit tests; Playwright Chromium e2e smoke tests

---

## 8. Exit criteria and approval gate

- `RESEARCH.md` and `PLAN.md` both approved by the owner before any app code is written (spec §0.7 hard gate — no exceptions).
- After approval, implementation proceeds M1 → M6, committing to `main` at each milestone.
- No production deploy (`--prod`) unless the owner explicitly asks.
