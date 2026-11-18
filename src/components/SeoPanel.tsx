// Roux Studio — SEO panel in the left sidebar.
//
// Lists the project's pages with SEO fields: title, slug and meta description.
// Each row commits title via renamePage and slug / meta description via
// updatePage when the field is blurred (one history step per edit). Renders
// nothing when the project has no pages.
import { Search } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import type { Page } from '../types';

export default function SeoPanel() {
  const pages = useEditorStore((state) => state.pages);
  const renamePage = useEditorStore((state) => state.renamePage);
  const updatePage = useEditorStore((state) => state.updatePage);

  if (pages.length === 0) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 flex items-center gap-2 border-b border-slate-800">
        <Search size={14} strokeWidth={2} />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">SEO</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {pages.map((page) => (
          <PageSeoRow
            key={page.id}
            page={page}
            renamePage={renamePage}
            updatePage={updatePage}
          />
        ))}
      </div>
    </div>
  );
}

function PageSeoRow({
  page,
  renamePage,
  updatePage,
}: {
  page: Page;
  renamePage: (pageId: string, title: string) => void;
  updatePage: (
    projectId: string | null,
    pageId: string,
    patch: { slug?: string; metaDescription?: string },
  ) => void;
}) {
  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const next = e.currentTarget.value.trim();
    if (!next || next === page.title) return;
    renamePage(page.id, next);
  };

  const handleSlugBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const next = e.currentTarget.value.trim();
    if (!next || next === page.slug) return;
    updatePage(null, page.id, { slug: next });
  };

  const handleMetaDescriptionBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const next = e.currentTarget.value;
    if (next === page.metaDescription) return;
    updatePage(null, page.id, { metaDescription: next });
  };

  return (
    <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-3">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label
            className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 w-[96px]"
          >
            Title
          </label>
          <input
            aria-label="Title"
            className="flex-1 px-2 py-1.5 text-sm bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            value={page.title}
            onBlur={handleTitleBlur}
          />
        </div>
        <div className="flex items-center gap-3">
          <label
            className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 w-[96px]"
          >
            Slug
          </label>
          <input
            aria-label="Slug"
            className="w-[200px] shrink-0 px-2 py-1.5 text-sm font-mono bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            value={page.slug}
            onBlur={handleSlugBlur}
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0"
          >
            Meta description
          </label>
          <textarea
            aria-label="Meta description"
            rows={3}
            className="flex-1 px-2 py-1.5 text-sm bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            value={page.metaDescription ?? ''}
            onBlur={handleMetaDescriptionBlur}
          />
        </div>
      </div>
    </div>
  );
}
