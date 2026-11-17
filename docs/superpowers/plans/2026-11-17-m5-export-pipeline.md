# M5 Export Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure, testable static-export pipeline for Roux Studio: one HTML page + single CSS + optional `<8 KB` gzipped vanilla JS (`defer`) per page, zipped via JSZip, plus Errors/Warnings pre-export checks with click-to-select (spec §11, §11.5).

**Architecture:** New `src/export/` module with four pure units: `export.ts` builds per-page HTML documents via `renderNode(mode:'export')` + `renderToStaticMarkup` wrapped in a full document (§11.2), `runtime.ts` emits the tree-shaken vanilla JS runtime source string (§9.3), `zip.ts` packs files into a JSZip blob (§11.1 structure), `checks.ts` runs Errors/Warnings pre-export checks with click-to-select node references (§11.5). `compileStyles` and `renderNode` already exist (M4) and are consumed, not modified.

**Tech Stack:** Vitest, React DOM Server (`renderToStaticMarkup`), JSZip, existing `compileStyles`/`renderNode`/`classFor`. No new runtime deps.

**Spec:** `docs/PLAN.md` §5 (M5), build spec `/home/user/Downloads/website-builder-claude-code-prompt1.md` §9 (runtime), §10 (assets), §11 (export), §11.5 (pre-export checks), §15.1 (export unit tests), §16 (M5 checklist), §18 (definition of done).

## Global Constraints

- Exported output: no inline `style` attributes, no `data-node-id`, no editor Tailwind classes (§11.3, §15.1).
- One `site.js`, vanilla ES2019+, no dependencies, minified, target < 8 KB gzipped, `defer`; emit no JS when no module is needed (§9.3).
- CSS: single `site.css`, reset + `:root` tokens + `@font-face` + base styles + node rules in document order + tablet + mobile + reduced-motion blocks; no `!important` except reduced-motion (§11.3).
- HTML: `<!doctype html>`, `<html lang>`, semantic tags, one `<main>` per page, charset/viewport/title/meta description, pretty-printed 2-space indent (§11.2).
- Output structure per §11.1: `{slug}/index.html`, `assets/css/site.css`, `assets/js/site.js`, `sitemap.xml`, `robots.txt`, `404.html`; delivered as JSZip `.zip`.
- Pre-export checks: Errors (block export unless "Export anyway") and Warnings, each clickable to select the offending element (§11.5).
- Strict TypeScript: no `any`, no `@ts-ignore` without a comment (spec §17.10). One small job at a time; commit after every job; run `pnpm build` + `pnpm test` before claiming done (spec §17.4).

## Review Focus

These input classes/failure modes are implied by the spec but not pinned by any single task's tests — each gets its test added to the owning task below:
1. A page with zero pages / missing root → export must not throw; emit empty/skip gracefully.
2. `data-node-id` must never appear in export-mode markup (canvas-only attribute).
3. Inline `style=` must never appear in export output (styles come from compiled classes only).
4. A page with no title → Error check item; duplicate slugs → Error check item.
5. An image with no alt → Warning check item; more than one or exactly zero H1s → Warning.
6. `site.js` must be `null`/absent when no runtime module is needed (tree-shaking).
7. gzipped runtime size must stay under 8 KB (§9.3 hard limit).
8. Global header/footer subtree classes compile into the page CSS and render in document order (header before children, footer after) when the page opts in (§4.4, DECISIONS 2026-11-17).

## Tasks

### Task 1: Export pipeline core — `src/export/export.ts` + `src/export/types.ts`

**Files:**
- Create: `src/export/types.ts`
- Create: `src/export/export.ts`
- Create: `src/export/export.test.ts`

**Interfaces:**
- Consumes: `compileStyles(project, pageId, nodes): string` (existing), `renderNode(node, {mode:'export', breakpoint, nodes, globalHeaderId, globalFooterId}): JSX.Element` (existing), `renderToStaticMarkup` (react-dom/server).
- Produces: `exportProject(options): ExportResult` where
  ```ts
  export interface ExportOptions {
    project: Project;
    nodes: Record<NodeId, Node>;
    baseUrl?: string;
    lang?: string;
  }
  export interface ExportPage { pageId: string; slug: string; path: string; html: string; }
  export interface ExportResult { pages: ExportPage[]; css: string; js: string | null; }
  ```

- [ ] **Step 1: Write the failing test** — `export.test.ts`: `exportProject` on a tiny project (one page, one section, one heading) produces exactly one page HTML; the HTML contains `<!doctype html>`, one `<main>`, the heading text, an `r-` class on the heading, and no `data-node-id` / no `style=`.
- [ ] **Step 2: Run test to verify it fails** — `pnpm test src/export/export.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement `exportProject`** in `src/export/export.ts` — for each page: resolve page root + global header/footer ids, compile CSS for the page, render root with `renderNode(mode:'export')`, wrap in full HTML document (doctype, head with charset/viewport/title/meta description, semantic body), pretty-print 2-space indent. Return per-page HTML + aggregated CSS + `js: null`.
- [ ] **Step 4: Run test to verify it passes** — `pnpm test src/export/export.test.ts` → PASS.
- [ ] **Step 5: Run full suite + typecheck** — `pnpm test` and `pnpm build` green.
- [ ] **Step 6: Commit** — `git add src/export/ docs/superpowers/plans/...` → `feat(export): add pure export pipeline core`.

### Task 2: Vanilla JS runtime source — `src/export/runtime.ts`

**Files:**
- Create: `src/export/runtime.ts`
- Create: `src/export/runtime.test.ts`

**Interfaces:**
- Consumes: none (pure string builder).
- Produces: `runtimeSource(modules: Set<string>): string | null` — returns `null` when `modules` is empty; otherwise a vanilla ES2019+ source string implementing only the requested modules (`'animations'` → IntersectionObserver scroll-in adding `.is-in`; `'video-lazy-load'` → click-to-play poster facade + lazy `src` within 200% viewport + pause offscreen). Source must be `< 8 KB` gzipped.

- [ ] **Step 1: Write the failing test** — `runtime.test.ts`: `runtimeSource(new Set())` → `null`; `runtimeSource(new Set(['animations']))` → a non-empty string containing `IntersectionObserver` and `.is-in`; gzipped size of the animations-only string < 8192 bytes.
- [ ] **Step 2: Run test to verify it fails.**
- [ ] **Step 3: Implement `runtimeSource`** in `src/export/runtime.ts`.
- [ ] **Step 4: Run test to verify it passes** — including gzip size assertion (use Node `zlib.gzipSync`).
- [ ] **Step 5: Run full suite + typecheck.**
- [ ] **Step 6: Commit** — `feat(export): add tree-shaken vanilla JS runtime`.

### Task 3: JSZip output — `src/export/zip.ts`

**Files:**
- Create: `src/export/zip.ts`
- Create: `src/export/zip.test.ts`

**Interfaces:**
- Consumes: `ExportResult` (from Task 1).
- Produces: `zipExport(result): Promise<Blob>` — packs `index.html` per page (nested as `{slug}/index.html`), `assets/css/site.css`, `assets/js/site.js` (only when js non-null), `sitemap.xml`, `robots.txt`, `404.html` per §11.1 structure; delivered as a JSZip blob.

- [ ] **Step 1: Write the failing test** — `zip.test.ts`: zip of a one-page result contains `index.html`, `assets/css/site.css`, `sitemap.xml`, `robots.txt`, `404.html`; no `assets/js/site.js` when `js` is null; blob is non-empty.
- [ ] **Step 2: Run test to verify it fails.**
- [ ] **Step 3: Implement `zipExport`** in `src/export/zip.ts` using JSZip (`import JSZip from 'jszip'`).
- [ ] **Step 4: Run test to verify it passes.**
- [ ] **Step 5: Run full suite + typecheck.**
- [ ] **Step 6: Commit** — `feat(export): add JSZip static-site output`.

### Task 4: Pre-export checks — `src/export/checks.ts`

**Files:**
- Create: `src/export/checks.ts`
- Create: `src/export/checks.test.ts`

**Interfaces:**
- Consumes: `project: Project`, `nodes: Record<NodeId, Node>`.
- Produces: `runPreExportChecks(project, nodes): PreExportResult` where
  ```ts
  export interface CheckItem { id: string; message: string; nodeId: NodeId | null; type: 'error' | 'warning'; }
  export interface PreExportResult { errors: CheckItem[]; warnings: CheckItem[]; }
  ```
  Each item is clickable-to-select via its `nodeId` (null for page-level checks like duplicate slugs / missing meta description).

- [ ] **Step 1: Write the failing test** — `checks.test.ts`: a project with a missing-title page, duplicate slugs, a broken asset reference (`image.src` pointing to a missing asset id), an image without alt, two H1s on one page, and a heading-level skip (h2→h4) → errors contain the missing-title/duplicate-slug/broken-asset items; warnings contain the alt/H1/skip items; each node-level item carries the offending `nodeId`.
- [ ] **Step 2: Run test to verify it fails.**
- [ ] **Step 3: Implement `runPreExportChecks`** in `src/export/checks.ts` — Errors: broken asset references, duplicate slugs, page with no title. Warnings: images without alt, zero/multiple H1s, heading-level skips (h2→h4), links/buttons with no accessible name, missing meta description, heavy image (>500 KB estimate), heavy video (>15 MB), missing fonts, form with no destination, total page weight estimate > 2 MB. Implement the checks that are deterministically computable from project+nodes alone (title, slugs, asset refs, alt, H1 count, heading skips, accessible name, meta description, form destination); mark the size/contrast/font checks as structurally present but note they need asset metadata in a follow-up (log in DECISIONS.md).
- [ ] **Step 4: Run test to verify it passes.**
- [ ] **Step 5: Run full suite + typecheck.**
- [ ] **Step 6: Commit** — `feat(export): add pre-export errors/warnings checks`.

### Task 5: Verify whole M5 slice + commit

- [ ] **Step 1: Run `pnpm build` (tsc + vite)** and `pnpm test` — all green.
- [ ] **Step 2: Log deferrals/notes in `DECISIONS.md`** (c-{hash} dedupe remains deferred; size/contrast/font checks need asset metadata follow-up; multi-page manager/SEO panel UI is a separate M5 UI task).
- [ ] **Step 3: Commit** — `chore(m5): verify export pipeline slice; update DECISIONS`.

## Self-Review

- Spec coverage: §11 output structure (Task 3), §11.2 HTML document (Task 1), §11.3 CSS via existing compileStyles (consumed, no new code), §9.3 runtime <8KB gzipped `defer` (Task 2), §11.5 pre-export checks (Task 4), §15.1 export unit tests (all tasks), §16 M5 export checklist (core export slice). Multi-page manager, SEO panel, image optimisation/WebP, sitemap absolute URLs requiring baseUrl, and `.roux.zip` import/export are M5 checklist items deferred to follow-up tasks — noted in DECISIONS.md.
- Step scan: each step is one actionable write with a checkable result; no TBD lines.
- Type consistency: `ExportResult`/`CheckItem` shapes defined in types.ts and checks.ts; tasks reference them by exact name.
- Review Focus: all eight items mapped to a task's tests.
- Proportion: plan is ~2x the spec section it implements; code bodies replaced by signatures/tests except the small runtime builder which is algorithmic.

Plan complete and saved to `docs/superpowers/plans/2026-11-17-m5-export-pipeline.md`.

Please review the plan. Does it capture what you want for the start of M5? Which execution approach should we use?

- **Native** (recommended) — I implement every task myself in this session, then one fresh reviewer checks the whole branch. Cheapest and fastest; the tasks share the `src/export/` interfaces so one context carries them well.
- **Subagent-driven** — a fresh subagent implements each task and a fresh reviewer checks it before the next starts; most thorough but costs a fresh context per task.
