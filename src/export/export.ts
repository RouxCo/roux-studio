// src/export/export.ts
// Roux Studio — pure static-export pipeline core (spec §11, §11.2).
//
// `exportProject` consumes the existing `compileStyles` (M4) and `renderNode`
// (mode: 'export') and produces one HTML document per page plus aggregated CSS.
// No inline `style` attributes, no `data-node-id` — styles come from compiled
// `r-<hash>` classes only. `js` is null here; the vanilla JS runtime is Task 2.

import { renderToStaticMarkup } from 'react-dom/server';
import { isPageNode } from '../types';
import { compileStyles } from '../compile/compileStyles';
import { renderNode, type RenderContext } from '../canvas/renderNode';
import { zipExport } from './zip';
import type { ExportOptions, ExportPage, ExportResult } from './types';

// Block-level tags that get their own indented line in the pretty printer.
const BLOCK_TAGS = new Set([
  'html',
  'head',
  'body',
  'main',
  'header',
  'footer',
  'nav',
  'section',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'article',
  'aside',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'table',
  'form',
]);
// Void elements never carry children and are self-closing.
const VOID_TAGS = new Set(['img', 'br', 'hr', 'meta', 'link', 'input', 'source']);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Lightweight HTML pretty-printer: 2-space indent around block tags. */
function prettyPrint(html: string, indentSize = 2): string {
  const lines: string[] = [];
  let depth = 0;
  let i = 0;
  const n = html.length;

  const flushText = (from: number, to: number) => {
    const text = html.slice(from, to).trim();
    if (text) lines.push(' '.repeat(depth * indentSize) + text);
  };

  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      flushText(i, n);
      break;
    }
    flushText(i, lt);
    i = lt;

    const gt = html.indexOf('>', i);
    if (gt === -1) {
      lines.push(' '.repeat(depth * indentSize) + html.slice(i));
      break;
    }
    const tag = html.slice(i, gt + 1);
    i = gt + 1;

    const m = tag.match(/^\s*<(\/?)([a-zA-Z0-9-]+)(\s[^>]*?)?\s*\/?>/);
    if (!m || !m[2]) {
      lines.push(' '.repeat(depth * indentSize) + tag);
      continue;
    }
    const isClose = m[1] === '/';
    const name = m[2].toLowerCase();
    const isVoid = VOID_TAGS.has(name);
    const isBlock = BLOCK_TAGS.has(name);

    if (isClose) {
      depth = Math.max(0, depth - 1);
      if (isBlock || isVoid) {
        lines.push(' '.repeat(depth * indentSize) + tag);
      } else if (lines.length) {
        lines[lines.length - 1] += tag;
      } else {
        lines.push(tag);
      }
    } else {
      if (isBlock) {
        lines.push(' '.repeat(depth * indentSize) + tag);
        if (!isVoid) depth++;
      } else {
        lines.push(' '.repeat(depth * indentSize) + tag);
      }
    }
  }

  return lines.join('\n');
}

function renderDocument({
  lang,
  title,
  body,
}: {
  lang: string;
  title: string;
  body: string;
}): string {
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    '<meta name="description" content="">',
    '<link rel="stylesheet" href="assets/css/site.css">',
  ].join('\n  ');

  return prettyPrint(
    `<!doctype html>
<html lang="${lang}">
<head>
  ${head}
</head>
<body>
${body}
</body>
</html>`,
  );
}

export function exportProject(options: ExportOptions): ExportResult {
  const { project, nodes, lang = 'en' } = options;
  const pages: ExportPage[] = [];
  const cssParts: string[] = [];

  for (const page of project.pages) {
    const root = nodes[page.rootId];
    if (!root || !isPageNode(root)) continue;

    // Compile this page's CSS (includes global header/footer when opted in).
    const pageCss = compileStyles(project, page.id, nodes);
    cssParts.push(pageCss);

    const ctx: RenderContext = {
      mode: 'export',
      breakpoint: 'desktop',
      nodes,
      globalHeaderId: page.useGlobalHeader ? project.globalHeaderId ?? null : null,
      globalFooterId: page.useGlobalFooter ? project.globalFooterId ?? null : null,
    };

    const body = renderToStaticMarkup(renderNode(root, ctx));
    const slug = page.slug;
    const path = `${slug}/index.html`;

    const html = renderDocument({
      lang,
      title: page.title,
      body,
    });

    pages.push({ pageId: page.id, slug, path, html });
  }

  return { pages, css: cssParts.join('\n'), js: null };
}

/** Compile then zip: exports the project and bundles the source project as
 * project.json so the zip can be re-imported as an editable project. */
export async function exportProjectToZip(options: ExportOptions): Promise<Blob> {
  const result = exportProject(options);
  return zipExport(result, {
    project: { ...options.project, nodes: options.nodes },
    webp: options.webp,
  });
}
