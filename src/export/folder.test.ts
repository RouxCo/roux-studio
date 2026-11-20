// src/export/folder.test.ts
// Folder export: writes a deploy-ready static site to disk.
import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { exportToFolder } from './folder'
import type { ExportPage, ExportResult } from './types'

function result(pages: ExportPage[], js: string | null = 'console.log("hi");'): ExportResult {
  return { pages, css: 'body { color: #111; }', js }
}

describe('exportToFolder', () => {
  it('writes one HTML per page, css, js and static files to disk', async () => {
    const outDir = join(await mkdtemp(join(tmpdir(), 'roux-folder-')), 'site')
    const pages: ExportPage[] = [
      { pageId: 'p1', slug: 'home', path: 'home/index.html', html: '<html>home</html>' },
      { pageId: 'p2', slug: 'about', path: 'about/index.html', html: '<html>about</html>' },
    ]

    const written = await exportToFolder(result(pages), outDir)

    const read = (p: string) => readFile(join(outDir, p), 'utf8')

    expect(await read('home/index.html')).toBe('<html>home</html>')
    expect(await read('about/index.html')).toBe('<html>about</html>')
    expect(await read('assets/css/site.css')).toBe('body { color: #111; }')
    expect(await read('assets/js/site.js')).toBe('console.log("hi");')
    expect(await read('sitemap.xml')).toContain('<urlset')
    expect(await read('robots.txt')).toContain('User-agent: *')
    expect(await read('404.html')).toContain('404')

    expect(written).toContain(join(outDir, 'home/index.html'))
    expect(written).toContain(join(outDir, 'about/index.html'))
    expect(written).toContain(join(outDir, 'assets/css/site.css'))
    expect(written).toContain(join(outDir, 'assets/js/site.js'))
    expect(written).toContain(join(outDir, 'sitemap.xml'))
    expect(written).toContain(join(outDir, 'robots.txt'))
    expect(written).toContain(join(outDir, '404.html'))

    await rm(outDir, { recursive: true, force: true })
  })

  it('omits assets/js/site.js when js is null', async () => {
    const outDir = join(await mkdtemp(join(tmpdir(), 'roux-folder-')), 'site')
    const pages: ExportPage[] = [
      { pageId: 'p1', slug: 'home', path: 'home/index.html', html: '<html>home</html>' },
    ]

    await exportToFolder(result(pages, null), outDir)

    await expect(
      readFile(join(outDir, 'assets/js/site.js'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(outDir, 'home/index.html'), 'utf8')).resolves.toBe(
      '<html>home</html>',
    )

    await rm(outDir, { recursive: true, force: true })
  })
})
