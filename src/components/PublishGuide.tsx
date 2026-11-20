// src/components/PublishGuide.tsx
// Roux Studio — publish-to guidance per host (M6).
//
// After exporting a static site (folder or .zip), this guide tells the user
// how to publish it to each supported host: Vercel, Netlify, Cloudflare Pages.
// No secrets are collected here — it's just instructions.
import { Upload, Globe } from 'lucide-react';

const PANEL =
  'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-md p-6 border border-slate-700 bg-slate-900 rounded-xl shadow-2xl text-slate-100';

interface HostCardProps {
  icon: React.ElementType;
  name: string;
  steps: string[];
  note?: React.ReactNode;
}

function HostCard({ icon: Icon, name, steps, note }: HostCardProps) {
  return (
    <div className="border border-slate-700 bg-slate-800/50 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} strokeWidth={2} className="text-cyan-400 shrink-0" />
        <h3 className="text-sm font-semibold">{name}</h3>
      </div>
      <ol className="text-xs text-slate-300 space-y-2 list-disc pl-4 mb-3">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {note && (
        <p className="text-[10px] text-slate-500">{note}</p>
      )}
    </div>
  );
}

interface PublishGuideProps {
  open: boolean;
  onClose: () => void;
}

export default function PublishGuide({ open, onClose }: PublishGuideProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] bg-slate-900/70"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={PANEL} onContextMenu={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2 mb-5">
          <Globe size={16} strokeWidth={2} className="text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-tight">Publish your site</h2>
        </div>

        <p className="text-xs text-slate-300 mb-6 leading-relaxed">
          Export your site as a folder or .zip from the export dialog, then
          publish it to any static host. Your exported output is plain HTML +
          CSS — no framework lock-in, no proprietary hosting.
        </p>

        <HostCard
          icon={Upload}
          name="Vercel"
          steps={[
            'In the Vercel dashboard, click "Add New" → "Deploy".',
            'Drag and drop your exported folder (or unzip the .zip) onto the deploy area.',
            'Your site gets a vercel.app URL and a Git-connected project for future deploys.',
          ]}
          note={
            <>
              Or use the CLI: <span className="text-cyan-300">vercel deploy --yes</span> in the exported folder.
            </>
          }
        />
        <HostCard
          icon={Upload}
          name="Netlify"
          steps={[
            'In Netlify, go to "Sites" → "Add site" → "Deploy manually".',
            'Drag and drop your exported folder onto the deploy area.',
            'Netlify gives you a netlify.app URL and optional custom domain.',
          ]}
        />
        <HostCard
          icon={Upload}
          name="Cloudflare Pages"
          steps={[
            'In Cloudflare, go to "Pages" → "Create a project" → "Upload assets".',
            'Drag and drop your exported folder (or unzip the .zip).',
            'Your site gets a pages.dev URL with automatic SSL.',
          ]}
        />

        <div className="border-t border-slate-700 pt-4 mt-4">
          <p className="text-[10px] text-slate-400 mb-3">
            General steps for any host:
          </p>
          <ol className="text-xs text-slate-300 space-y-1 list-disc pl-4 mb-4">
            <li>Export the site from Roux Studio (folder or .zip).</li>
            <li>Unzip the .zip if you downloaded one.</li>
            <li>Drag the folder onto your host's manual-deploy area.</li>
            <li>Open the host's URL and check your pages load.</li>
          </ol>
          <p className="text-xs text-slate-400">
            Need a custom domain? Add it in your host's dashboard after the
            first deploy — no changes to your exported files required.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
