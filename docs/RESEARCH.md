# RESEARCH.md — Roux Studio Phase 0

**Client:** Roux and Co. (South African web design agency)
**Product:** Roux Studio — local-first, browser-based visual website builder exporting clean static sites
**Date:** 2026-11-15
**Spec:** `website-builder-claude-code-prompt1.md` (sections 0–18), §0 Phase 0 research
**Status:** Complete — awaiting owner approval together with `PLAN.md` before any app code is written.

---

## 1. Tools used

| Tool | How it was used |
|------|-----------------|
| Web search + WebFetch | Public product docs, help centres, and academy pages for Wix, Webflow, Framer, Squarespace, Elementor, Shopify, Canva Websites. No accounts created, no logins, no payment details entered (per §0.4). |
| sandbox-browser (Playwright) | Attempted to load editor pages for visual/DOM inspection and screenshots. Several editor URLs returned 404/403; fell back to public help-centre pages instead. |
| rtk 0.44.2 | Token-optimized CLI output for shell commands during research (`rtk gain`, `rtk proxy`). |
| craft-anything | Used to open the downloaded Webflow, Framer and Hellobonsai page bundles and grep their HTML/CSS/JS for export-code and animation patterns (class naming, data attributes, runtime scripts, GSAP/motion usage). Deep native-code analysis is not supported for web-page targets, so findings come from direct file reads + grep. |

**Research rules followed (§0.4):** patterns and interaction models only; no accounts/trials/payment details; no copying of proprietary code, CSS, icons, images, fonts, templates, copy, or branding; screenshots used for analysis only and never committed into shipped assets (the `research/` folder is git-ignored); public docs used where login/blockers prevented direct access; robots.txt respected, light automated access only.

---

## 2. Per-product copy / avoid notes (with source URLs)

Each entry lists the interaction/design **patterns** worth borrowing (copy) and what to **avoid** (proprietary lock-in, platform coupling, branded elements we must not reproduce). Source URLs are public docs/help centres only.

### 2.1 Wix (editor + Wix Studio)

**Copy:** Left-hand control panels + central canvas + top bar layout; editor menus for add/undo/redo/preview/publish; breakpoint-aware responsive editing; section-based page structure. Wix's editor organises controls into a persistent side panel acting on a selected element inside a canvas — the classic "preview + panel" split we adopt.
**Avoid:** Velo/code-sidebar coupling to the editor UI; Wix-specific hosting and publishing lock-in; ADI (Artificial Design Intelligence) wizard behaviour; Wix-branded UI copy and colours; any Wix template assets.

Sources:
- [Wix Editor: Using the Editor Menus](https://support.wix.com/en/article/wix-editor-using-the-editor-menus)
- [Explore the Wix Studio Editor](https://www.wix.com/studio/academy/tutorials/how-to-get-started-in-the-wix-studio-editor)
- [About Panels in Blocks (Wix)](https://dev.wix.com/docs/build-apps/develop-your-app/develop-an-app-with-blocks/editor-experience-panels/about-panels-in-blocks)

### 2.2 Webflow (Designer)

**Copy:** Three-pane layout — Navigator tree (left), central canvas, Style panel inspector (right); class-based styling; breakpoint controls (desktop/tablet/mobile/landscape); Navigator for selection, hierarchy, and reorder; style inspector grouped into Layout/Typography/Colors/etc. sections. Webflow's separation of structure (Navigator) from appearance (Style panel) maps directly onto our Layers tree + Inspector.
**Avoid:** Webflow-specific hosting/CMS binding; class-name semantics tied to Webflow's export; Webflow interactions/animations tied to their runtime; Webflow-branded copy and colour scheme.

Sources:
- [Navigator panel - Webflow University](https://university.webflow.com/videos/navigator)
- [Style panel overview - Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961362040723-Style-panel-overview)
- [Navigator - Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961320786451-Navigator)
- [Welcome to the Webflow UI](https://university.webflow.com/videos/welcome-to-the-webflow-ui)

### 2.3 Framer

**Copy:** Frames + Stacks layout model (Stack = flex container); positioning modes (relative/absolute/sticky); canvas with right-hand property panel; breakpoint-responsive constraints; scroll/animate-on-scroll patterns. Framer's "everything is a frame" mental model informs our section/container/box element hierarchy.
**Avoid:** Framer-specific hosting and canvas runtime; Framer Motion as an export dependency (spec §2 bans Framer Motion in exports — vanilla JS/CSS only); Framer-branded UI.

Sources:
- [Build flexible layouts with Frames and Stacks](https://www.framer.com/academy/lessons/frames-vs-stacks)
- [Positioning modes in Framer](https://www.framer.com/academy/lessons/layer-positioning-modes-in-framer)
- [Absolute Positioning in Framer (Fundamentals Lesson 5)](https://keepo.framer.website/resources/tutorials/absolute-positioning-in-framer-(fundamentals-lesson-5))

### 2.4 Squarespace (Fluid Engine)

**Copy:** Section-scoped drag-and-drop (elements drag within a section, not free-floating page-wide); grid snapping and alignment guides; section backgrounds (image/color/gradient) with per-section styling. Fluid Engine's section-containment model reinforces our spec §7 containment rules (sections contain elements, sections don't nest).
**Avoid:** Section-locked layout (no free positioning outside sections — we allow absolute positioning per spec); template and asset coupling to Squarespace hosting; Squarespace-branded copy/colours.

Sources:
- [Fluid Engine - Drag and Drop Website Editor](https://www.squarespace.com/websites/fluid-engine)
- [Edit your site with Fluid Engine - Squarespace Help Center](https://support.squarespace.com/hc/en-us/articles/6421525446541-Edit-your-site-with-Fluid-Engine)

### 2.5 Elementor

**Copy:** Preview canvas (right) + widget/settings panel (left); section → column → widget nesting; responsive editing per device; widget-based element library; inline text editing on canvas. Elementor's panel/preview split and hierarchical container model directly inform our editor shell and element registry.
**Avoid:** WordPress/PHP coupling and shortcode output; Elementor-specific markup and CSS class output; Elementor banner/nag UI; any Elementor widget assets or templates.

Sources:
- [Explore the Elementor Editor](https://elementor.com/help/explore-the-elementor-editor/)
- [Elementor Editor | Elementor Developers](https://developers.elementor.com/docs//editor/)
- [Elementor Panel | Elementor Developers](https://developers.elementor.com/docs/editor/elementor-panel)

### 2.6 Shopify (Online Store theme editor)

**Copy:** Sections + Blocks reuse model (save a configured block, insert elsewhere); live preview + left settings panel; global theme settings (colours, typography) applied site-wide; page-type templates. Shopify's sections/blocks model informs our Blocks feature (§4.22 of spec) and global header/footer.
**Avoid:** Shopify Liquid/template coupling; ecommerce-only scope (we build general marketing sites); Shopify-branded UI and copy.

Sources:
- [Theme editor features overview - Shopify Help Center](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/features-overview)
- [The theme editor - Shopify Developers Platform](https://shopify.dev/docs/storefronts/themes/tools/online-editor)
- [Theme editor best practices - Shopify Developers](https://shopify.dev/docs/storefronts/themes/best-practices/editor)

### 2.7 Canva Websites

**Copy:** Template-first onboarding (pick a template, then customise); simple drag-and-drop; multi-page page picker/switcher; minimal, non-technical styling controls; publish-to-web flow. Canva's template-first approach informs our four starter templates (§13) and project-list screen.
**Avoid:** Oversimplified styling (no real per-breakpoint CSS control — we must exceed this); Canva export/hosting lock-in; Canva-branded assets and copy; any Canva template files.

Sources:
- [Drag and drop website builder - Canva](https://www.canva.com/website-builder/drag-and-drop/)
- [Free Business Website Maker - Canva](https://www.canva.com/create/business-websites/)

---

## 3. Feature comparison table

| Product | Canvas preview | Structure panel | Style inspector | Breakpoints | Export / output | Lock-in risk | Notes for Roux Studio |
|---------|---------------|-----------------|-----------------|-------------|-----------------|--------------|----------------------|
| Wix | Central canvas | Left panels | Left/context panels | Desktop + mobile | Proprietary hosting | High | Panel+canvas split; avoid Velo/code coupling |
| Webflow | Central canvas | Navigator (left tree) | Style panel (right) | 4 breakpoints | Proprietary hosting / code export | High | Navigator + right inspector is our shell model |
| Framer | Central canvas | Layers (left) | Properties (right) | Custom breakpoints | Proprietary hosting | High | Frames/Stacks layout model; no Framer Motion in export |
| Squarespace | Section canvas | In-section selection | Side panel | Desktop/mobile | Proprietary hosting | High | Section-scoped drag; containment rules |
| Elementor | Preview (right) | Widget panel (left) | Widget panel (left) | Desktop/tablet/mobile | WordPress/PHP shortcodes | High | Section/column/widget nesting; avoid WP coupling |
| Shopify | Live preview | Sections/blocks panel | Settings panel (left) | Desktop/mobile | Liquid themes | High | Sections/blocks reuse; global theme settings |
| Canva Websites | Page canvas | Page picker | Simple side panel | Limited | Canva-hosted sites | High | Template-first onboarding; exceed Canva's styling depth |
| **Roux Studio** | **iframe canvas, same-origin srcdoc** | **Layers tree (left)** | **Inspector (right)** | **1440 / 768 / 390** | **Static HTML+CSS+JS zip** | **None** | **Local-first, IndexedDB, .roux.zip, clean static export** |

Key takeaway: every incumbent ties a rich editor to proprietary hosting. Roux Studio's differentiator is a desktop-class editor that exports **clean, portable, self-hosted static sites** with no lock-in — matching the spec's "deploy to Cloudflare Pages, Netlify, or Vercel" goal.

---

## 4. Editor-dashboard inspiration (Behance/Dribbble shots + takeaways)

Seven specific shots used for editor-dashboard UI direction. Each is a public reference captured for analysis only — no assets copied, nothing reproduced verbatim; all visual direction is re-derived in our own design system (see `distinctive-design` generic-test requirement).

| # | Shot | What we're taking |
|---|------|-------------------|
| 1 | [Siteliyo | Project Dashboard UI for Website Builder (Behance)](https://www.behance.net/gallery/226323123/Siteliyo-Project-Dashboard-UI-for-Website-Builder) | Website-builder project dashboard: project cards grid, quick-stat summary cards at top, left nav + top bar chrome, recent-sites list. |
| 2 | [No Code Website Builder (Behance)](https://www.behance.net/gallery/190459033/No-Code-Website-Builder) | Landing-page builder canvas: drag-and-drop section arrangement, block library sidebar, inline editing cues, mobile/desktop preview toggle. |
| 3 | [No-Code AI Website Builder Website (Behance)](https://www.behance.net/gallery/221874735/No-Code-AI-Website-Builder-Website) | AI-generated site flow: prompt input, generated layout preview, theme/color variant selection, publish call-to-action. |
| 4 | [No-Code Website Builder Landing page (Behance)](https://www.behance.net/gallery/205973577/No-Code-Website-Builder-Landing-page) | Hero structure: value proposition + screenshot preview side by side, feature grid below, pricing tier cards, trust-logos row. |
| 5 | [Buildora - AI No Code Website Builder - SaaS Case Study (Behance)](https://www.behance.net/gallery/246808813/Buildora-AI-No-Code-Website-Builder-SaaS-Case-Study) | SaaS dashboard chrome: sidebar navigation, top search + profile bar, analytics cards, template gallery with hover states. |
| 6 | [Dashboard UI by Nixtio (Dribbble)](https://dribbble.com/shots/25683483-Dashboard-UI) | Dashboard card anatomy: metric chips, progress rings, recent-activity list, clean whitespace with subtle borders. |
| 7 | [No Code Development Web Dashboard by Shakuro (Dribbble)](https://dribbble.com/shots/22478247-No-Code-Development-Web-Dashboard) | Web-dashboard editor: left canvas preview, right property inspector with typography/color/spacing controls, breakpoints toggle. |

No individual shot was reproduced; all visual direction is re-derived in our own design system.

---

## 5. Numbered UX decisions (with citations)

1. **Three-pane editor shell** — left Layers/Navigator tree, centre iframe canvas, right Inspector. Pattern validated by Webflow (Navigator left + Style panel right) and Elementor (panel + preview split). [Webflow Navigator; Elementor Editor]
2. **Per-breakpoint overrides with visual indicators** — desktop-first 1440/768/390, indicators show which breakpoints have overrides, one-click reset. Validated by Webflow's breakpoint controls and Framer's responsive constraints. [Webflow Style panel; Framer Positioning modes]
3. **Background layer stack where list top = front layer** — matches Photoshop/layer-editor convention and the spec §8.1; panel supports add/reorder/duplicate/rename/hide/delete. Spec-mandated; reinforced by Wix section-background layering. [Wix Editor Menus; spec §8]
4. **Feathered section blending via background wrapper only** — `mask-image` on the `.r-bg` wrapper, never content; overlap via `top: -Npx` on wrapper; sections `overflow: visible`. Spec-mandated §8.2; visually analogous to Squarespace/Wix section-background blends but implemented as our own CSS. [spec §8.2; Squarespace Fluid Engine]
5. **Template-first project creation** — four starter templates + blank; project list offers template or blank at creation. Validated by Canva Websites' template-first onboarding. [Canva Websites]
6. **Sections + Blocks reuse model** — save a configured element group as a block, insert into any page; global header/footer as special blocks. Validated by Shopify's sections/blocks. [Shopify theme editor]
7. **Global design tokens with references** — token panel, `var(--color-primary)` references, detach/promote, deletion handling. Spec-mandated §4/§5.3; aligns with Shopify global theme settings and Webflow styles. [Shopify theme editor; Webflow Styles]
8. **Clean static export, no editor artefacts** — no inline styles, no `data-node-id`, no Tailwind classes, minimal vanilla JS `<8KB gzipped`, `defer`. Differentiates from every incumbent's proprietary output. [spec §11; contrast with all seven products]
9. **Click-to-load video/slideshow facades** — poster + play button, lazy-load `src` within 200% viewport, pause offscreen. Spec-mandated §8.3/§8.4; performance pattern common to modern builders. [spec §8]
10. **Multi-tab safety via BroadcastChannel + revision** — read-only unless "Take over"; conflict dialog on save. Spec-mandated §12; no direct incumbent pattern copied, derived from the spec's conflict requirements. [spec §12]
11. **Pre-export checks grouped Errors/Warnings with click-to-select** — spec-mandated §11.5; no incumbent pattern copied. [spec §11.5]
12. **Copy uses "we" not "I"; avoid-ai-writing on all copy** — CLAUDE.md requirement; applied to template copy (§13 requires SA business copy, no lorem ipsum, no real names/numbers). [CLAUDE.md; spec §13]

---

## 6. Accepted spec changes (owner-approved, 2026-11-16)

The owner accepted all three proposed spec changes. They are now binding constraints on the build:

1. **Visible "Publish to" host choice in export** — the export dialog presents a host choice (Cloudflare Pages / Netlify / Vercel) with per-host publish instructions. Our export stays host-agnostic; this is only the UI surface for choosing where to deploy.
2. **Template thumbnail generation** — each of the four starter templates gets a generated thumbnail PNG shown in the project-list screen, built at build time from a template preview (optional, M4/M5).
3. **Blocks as its own left-panel tab** — Blocks surfaces as its own tab in the left panel (in M3/M4), not buried in the Insert menu. The left panel has two tabs: Layers (navigator) and Blocks.

`PLAN.md` folds these into the M3–M4 milestones.

---

## 7. craft-anything export-code + animation findings

Deep native-code analysis of web pages isn't supported by craft-anything, so findings come from manual reads of the downloaded Webflow, Framer and Hellobonsai page bundles plus grep across HTML/CSS/JS. All findings are interaction-model observations only — no proprietary code copied.

### 7.1 Export-code patterns (Webflow / Framer / Hellobonsai)

**Webflow (webflow.html + webflow-opt.css + webflow-shared.css + webflow-runtime.js)**
- Class naming: `w-` prefixed utility classes (`w-div`, `w-section`, `w-container`, `w-nav`, `w-button`) — exported class names carry platform semantics; our export uses our own `r-{hash}` classes instead.
- Data attributes: `data-wf-element-id`, `data-wf-component-context`, `data-wf-page-id`, `data-wf-ignore` on elements — export-time identifiers, not present in our clean export (we emit no `data-node-id`).
- Runtime script: `webflow-runtime.js` (4.8 KB) + GSAP 3.15.0 with ScrollTrigger + SplitText; `data-animation-gsap` values on elements drive large/small animation variants. Webflow bundles a runtime into the export — our spec bans this (vanilla JS `<8KB` gzipped only).
- Inline styles: 4 inline `style=` attributes on the page; transforms and `will-change` used on animated elements.
- Takeaway: exported class names + data attributes are platform-coupled. Roux Studio exports `r-{hash}` classes, no `data-*` runtime identifiers, no bundled runtime, and our own minimal JS.

**Framer (framer.html + framer-utils.mjs)**
- Module script: `data-framer-bundle="main"` — a single bundle script drives the page. Framer's output is module-bundle coupled; our export is a single plain `<script defer>` with no build-tool coupling.
- Animation keywords in markup/JS: `animate`, `motion`, `layout`, `keyframes`, `spring`, `ease` — Framer Motion concepts baked into exported output. Our spec bans Framer Motion; we emit plain CSS keyframes + vanilla JS IntersectionObserver.
- 6 inline `style=` attributes on the page.
- Takeaway: animation keywords tied to a runtime are avoided; we use data-driven CSS classes (`data-animation-*` style markers interpreted by our tiny vanilla JS runtime, not Framer Motion).

**Hellobonsai (hellobonsai.html)**
- CSS animation primitives: `transform` x73, `transition` x71, `fade` x25, `keyframes` x1, `will-change` x1 — shows heavy reliance on CSS transforms/transitions for motion, with `will-change` sparingly used.
- Takeaway: plain CSS transforms + transitions are the workhorse of exported animation. Our runtime mirrors this: CSS keyframes + transform/transition, plus a `<8KB` vanilla JS IntersectionObserver script for reveal-on-scroll and click-to-load facades.

### 7.2 Animation patterns adopted (export runtime)

| Source | Pattern observed | Roux Studio export equivalent |
|--------|------------------|-------------------------------|
| Webflow | GSAP data-animation-gsap variants; ScrollTrigger reveal | CSS keyframes + vanilla JS IntersectionObserver reveal-on-scroll |
| Framer | animate/motion/layout/keyframes/spring/ease | Plain CSS keyframes + transition classes, data-driven |
| Hellobonsai | transform x73, transition x71, fade x25, will-change x1 | CSS transform/transition keyframes; will-change on animated layers only |

Export runtime budget: plain CSS + vanilla JS `<8KB` gzipped `site.js`, `defer`, no React, no Framer Motion, no GSAP, no Webflow runtime.

---

## 8. Conclusion

Research confirms the market gap: every major visual builder (Wix, Webflow, Framer, Squarespace, Elementor, Shopify, Canva Websites) ties its editor to proprietary hosting and output. Roux Studio's value proposition — a desktop-class, local-first visual builder exporting clean, portable static sites (HTML + one CSS + minimal JS + assets) as a `.zip` deployable anywhere — is distinct and well-supported by the observed patterns (panel+canvas split, Navigator/tree + Inspector, breakpoint overrides, sections/blocks reuse, template-first onboarding).

**Next step:** `PLAN.md` folds these decisions into architecture, data flow, risks, and the M1–M6 milestone breakdown. Both `RESEARCH.md` and `PLAN.md` must be approved by the owner before any app code is written (spec §0.7).
