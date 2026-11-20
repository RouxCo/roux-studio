// src/export/folder.ts
// Roux Studio — folder (deploy-ready) static export (spec §11.1).
//
// `exportToFolder(result, outDir)` writes an ExportResult to disk as a
// deploy-ready static site: one HTML file per page, aggregated CSS, the
// optional vanilla JS runtime, plus sitemap.xml, robots.txt and 404.html.
//
// This is Node-only (uses `node:fs`/`node:path`) and is intended to be run
// from a build/CI script, not bundled into the browser app.

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { notFoundHtml, robotsTxt, sitemapXml } from './zip'
import type { ExportResult } from './types'

/** Write a single file, creating parent directories as needed. */
async function writeFileRecursive(filePath: string, content: string): Promise<void> {
  await mkdir(join(filePath, '..'), { recursive: true })
  await writeFile(filePath, content, 'utf8')
}

/** Export `result` to `outDir` on disk. Returns the list of written file paths. */
export async function exportToFolder(
  result: ExportResult,
  outDir: string,
): Promise<string[]> {
  const written: string[] = []

  for (const page of result.pages) {
    const pagePath = join(outDir, page.path)
    await writeFileRecursive(pagePath, page.html)
    written.push(pagePath)
  }

  await writeFileRecursive(join(outDir, 'assets/css/site.css'), result.css)
  written.push(join(outDir, 'assets/css/site.css'))

  if (result.js) {
    await writeFileRecursive(join(outDir, 'assets/js/site.js'), result.js)
    written.push(join(outDir, 'assets/js/site.js'))
  }

  await writeFileRecursive(join(outDir, 'sitemap.xml'), sitemapXml(result.pages))
  written.push(join(outDir, 'sitemap.xml'))

  await writeFileRecursive(join(outDir, 'robots.txt'), robotsTxt())
  written.push(join(outDir, 'robots.txt'))

  await writeFileRecursive(join(outDir, '404.html'), notFoundHtml())
  written.push(join(outDir, '404.html'))

  return written
}
