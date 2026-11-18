// src/components/ExportDialog.tsx
// Export modal: runs the pre-export checks and downloads the site as a
// published .zip or an editable .roux.zip. (M5 Job 9)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import type { Project } from '../types'
import { useEditorStore } from '../store/useEditorStore'
import { exportProject, exportProjectToZip } from '../export/export'
import type { ExportOptions } from '../export/types'
import { zipExport } from '../export/zip'
import { runPreExportChecks, type PreExportResult } from '../export/checks'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

const PANEL =
  'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-md p-6 border border-slate-700 bg-slate-900 rounded-xl shadow-2xl text-slate-100'

function slugify(name: string): string {
  let slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) slug = 'site'
  return slug
}

/** Save a blob to downloads via a temporary anchor, then revoke its URL. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.style.display = 'none'
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export default function ExportDialog({ open, onClose }: ExportDialogProps) {
  const projectId = useEditorStore((state) => state.projectId)
  const projectName = useEditorStore((state) => state.projectName)
  const pages = useEditorStore((state) => state.pages)
  const tokens = useEditorStore((state) => state.tokens)
  const nodes = useEditorStore((state) => state.nodes)
  const blocks = useEditorStore((state) => state.blocks)
  const globalHeaderId = useEditorStore((state) => state.globalHeaderId)
  const globalFooterId = useEditorStore((state) => state.globalFooterId)

  const [baseUrl, setBaseUrl] = useState('')
  const [webp, setWebp] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [checks, setChecks] = useState<PreExportResult>({ errors: [], warnings: [] })

  const project = useMemo<Project>(() => {
    const now = new Date().toISOString()
    return {
      id: projectId ?? 'draft',
      name: projectName,
      pages,
      tokens,
      blocks,
      globalHeaderId,
      globalFooterId,
      createdAt: now,
      updatedAt: now,
    }
  }, [projectId, projectName, pages, tokens, blocks, globalHeaderId, globalFooterId])

  const runChecks = useCallback(() => {
    setChecks(runPreExportChecks(project, nodes))
  }, [project, nodes])

  // Re-run the checks whenever the dialog opens or the project data changes
  // (pages included).
  useEffect(() => {
    if (!open) return
    runChecks()
  }, [open, runChecks])

  const blocked = checks.errors.length > 0

  const handleDownloadSite = useCallback(async () => {
    if (blocked || downloading) return
    setDownloading(true)
    try {
      const options: ExportOptions = { project, nodes, baseUrl, webp }
      const result = exportProject(options)
      const blob = await zipExport(result, {
        project: { ...project, nodes },
        baseUrl,
        webp,
      })
      downloadBlob(blob, `${slugify(projectName)}.zip`)
    } finally {
      setDownloading(false)
    }
  }, [blocked, downloading, project, nodes, baseUrl, webp, projectName])

  const handleDownloadEditable = useCallback(async () => {
    if (blocked || downloading) return
    setDownloading(true)
    try {
      const blob = await exportProjectToZip({ project, nodes, baseUrl, webp })
      downloadBlob(blob, `${slugify(projectName)}.roux.zip`)
    } finally {
      setDownloading(false)
    }
  }, [blocked, downloading, project, nodes, baseUrl, webp, projectName])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[55] bg-slate-900/70" onContextMenu={(e) => e.preventDefault()}>
      <div className={PANEL} onContextMenu={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2 mb-5">
          <Download size={16} strokeWidth={2} className="text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-tight">Export site</h2>
        </div>

        <label className="block text-xs text-slate-400 mb-1">Base URL</label>
        <input
          value={baseUrl}
          onInput={(e) => setBaseUrl((e.target as HTMLInputElement).value)}
          placeholder="https://example.com"
          className="w-full mb-4 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
        />
        <p className="text-xs text-slate-500 mb-5">
          Optional — used for absolute URLs in sitemap.xml.
        </p>

        <label className="flex items-center gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={webp}
            onChange={(e) => setWebp(e.target.checked)}
            className="rounded border border-slate-700 bg-slate-800 text-cyan-600 focus:ring-cyan-500"
          />
          <span className="text-sm text-slate-200">Use WebP images</span>
        </label>
        <p className="text-xs text-slate-500 mb-5">
          Serves referenced images as WebP with a PNG/JPEG fallback.
        </p>

        {checks.errors.length > 0 || checks.warnings.length > 0 ? (
          <>
            {checks.errors.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-rose-400 mb-2">
                  Errors ({checks.errors.length})
                </h3>
                <ul className="text-xs text-slate-300 space-y-1">
                  {checks.errors.map((check) => (
                    <li key={check.id}>{check.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {checks.warnings.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-semibold text-amber-400 mb-2">
                  Warnings ({checks.warnings.length})
                </h3>
                <ul className="text-xs text-slate-300 space-y-1">
                  {checks.warnings.map((check) => (
                    <li key={check.id}>{check.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-emerald-400 mb-5">
            No problems found — ready to export.
          </p>
        )}

        {blocked && (
          <p className="text-xs text-rose-400 mb-5">
            Fix the errors above before exporting.
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={blocked || downloading}
            onClick={handleDownloadSite}
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 disabled:opacity-50 disabled:pointer-events-none hover:!bg-slate-700"
          >
            {downloading ? 'Preparing…' : 'Download site (.zip)'}
          </button>
          <button
            type="button"
            disabled={blocked || downloading}
            onClick={handleDownloadEditable}
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 disabled:opacity-50 disabled:pointer-events-none hover:!bg-slate-700"
          >
            {downloading ? 'Preparing…' : 'Download editable (.roux.zip)'}
          </button>
        </div>
      </div>
    </div>
  )
}
