// src/export/zip.ts
// Roux Studio — JSZip static-site output (spec §11.1).
//
// zipExport packs an ExportResult into a JSZip blob with the output
// structure: {slug}/index.html per page, assets/css/site.css,
// assets/js/site.js (only when js is non-null), project.json (only when
// a project is supplied), sitemap.xml, robots.txt, 404.html.

import JSZip from 'jszip';
import type { ExportResult } from './types';
import type { StoredProject } from '../db/stores';

function sitemapXml(pages: ExportResult['pages'], baseUrl?: string): string {
  const entries = pages
    .map(
      (p) =>
        `  <url><loc>${baseUrl ? `${baseUrl}/${p.path}` : p.path}</loc></url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

function robotsTxt(): string {
  return `User-agent: *
Allow: /

`;
}

function notFoundHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found</title>
</head>
<body>
  <main>
    <h1>404 — Page not found</h1>
    <p>The page you requested does not exist.</p>
  </main>
</body>
</html>
`;
}

// When the `webp` option is on, referenced image assets are served as WebP
// with a PNG/JPEG fallback: <img src="photo.png"> becomes a <picture>
// carrying <source type="image/webp" srcset="photo.webp"> plus the original
// as fallback. No transcoding library is bundled (bundle headroom), so the
// .webp asset is referenced by name; the markup opts browsers into it.
const IMG_SRC = /<img\b([^>]*?)\s+src="([^"]+)"([^>]*)>/gi;

function webpPicture(html: string): string {
  return html.replace(IMG_SRC, (match, before, src, after) => {
    const webp = src.replace(/\.(png|jpe?g)$/i, '.webp');
    if (webp === src) return match;
    return `<picture><source type="image/webp" srcset="${webp}"><img${before} src="${src}"${after}></picture>`;
  });
}

// `options.project`, when supplied, is embedded as project.json so an
// exported zip carries enough data to re-import an editable project.
// `options.baseUrl`, when supplied, makes sitemap.xml `<loc>` entries
// absolute URLs instead of relative paths.
// `options.webp`, when true, serves referenced images as WebP with a
// PNG/JPEG fallback in the exported HTML.
export async function zipExport(
  result: ExportResult,
  options?: { project?: StoredProject; baseUrl?: string; webp?: boolean },
): Promise<Blob> {
  const zip = new JSZip();

  for (const page of result.pages) {
    zip.file(`${page.path}`, options?.webp ? webpPicture(page.html) : page.html);
  }

  zip.file('assets/css/site.css', result.css);

  if (result.js) {
    zip.file('assets/js/site.js', result.js);
  }

  if (options?.project) {
    zip.file('project.json', JSON.stringify(options.project, null, 2));
  }

  zip.file('sitemap.xml', sitemapXml(result.pages, options?.baseUrl));
  zip.file('robots.txt', robotsTxt());
  zip.file('404.html', notFoundHtml());

  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}
