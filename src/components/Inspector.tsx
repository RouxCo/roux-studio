// Roux Studio — right-hand Inspector panel.
//
// Edits the selected node's ResponsiveStyles for the active breakpoint through
// useEditorStore. Each control shows the value resolved at the active breakpoint
// (desktop-first: mobile ?? tablet ?? desktop) and marks an explicit breakpoint
// override with a dot. Clicking reset removes that override so the value falls
// back to the base/default. With nothing selected, an empty state is shown.
import { useCallback } from 'react';
import { RotateCw } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import type { Node, NodeId, Breakpoint, Length, Responsive, ResponsiveStyles } from '../types';
import { resolveResponsive } from '../types';
import { lengthToCss } from '../canvas/renderNode';

type Kind = 'length' | 'number' | 'text';

interface StyleField {
  key: keyof ResponsiveStyles;
  label: string;
  kind: Kind;
  placeholder?: string;
}

const LAYOUT: StyleField[] = [
  { key: 'display', label: 'Display', kind: 'text', placeholder: 'flex | block | grid | none' },
  { key: 'width', label: 'Width', kind: 'length', placeholder: 'e.g. 100%' },
  { key: 'height', label: 'Height', kind: 'length', placeholder: 'e.g. auto' },
  { key: 'flexDirection', label: 'Flex direction', kind: 'text', placeholder: 'row | column' },
  { key: 'justifyContent', label: 'Justify content', kind: 'text', placeholder: 'flex-start | center | space-between' },
  { key: 'alignItems', label: 'Align items', kind: 'text', placeholder: 'stretch | center | flex-start' },
  { key: 'position', label: 'Position', kind: 'text', placeholder: 'static | relative | absolute' },
  { key: 'overflow', label: 'Overflow', kind: 'text', placeholder: 'visible | hidden | auto | scroll' },
];

const TYPOGRAPHY: StyleField[] = [
  { key: 'fontFamily', label: 'Font family', kind: 'text', placeholder: 'e.g. Inter' },
  { key: 'fontSize', label: 'Font size', kind: 'length', placeholder: 'e.g. 16px' },
  { key: 'fontWeight', label: 'Font weight', kind: 'number', placeholder: 'e.g. 400' },
  { key: 'lineHeight', label: 'Line height', kind: 'text', placeholder: 'e.g. 1.5' },
  { key: 'letterSpacing', label: 'Letter spacing', kind: 'text', placeholder: 'e.g. 0px' },
  { key: 'textAlign', label: 'Text align', kind: 'text', placeholder: 'left | center | right' },
  { key: 'textTransform', label: 'Text transform', kind: 'text', placeholder: 'none | uppercase | lowercase' },
];

const COLORS: StyleField[] = [
  { key: 'color', label: 'Color', kind: 'text', placeholder: '#hex' },
  { key: 'backgroundColor', label: 'Background', kind: 'text', placeholder: '#hex' },
  { key: 'opacity', label: 'Opacity', kind: 'number', placeholder: '0..1' },
];

const SPACING: StyleField[] = [
  { key: 'margin', label: 'Margin', kind: 'length', placeholder: 'e.g. 16px' },
  { key: 'padding', label: 'Padding', kind: 'length', placeholder: 'e.g. 24px' },
  { key: 'gap', label: 'Gap', kind: 'length', placeholder: 'e.g. 8px' },
];

interface SectionProps {
  title: string;
  fields: StyleField[];
  nodeId: NodeId;
  breakpoint: Breakpoint;
  nodes: Record<NodeId, Node>;
}

function Section({ title, fields, nodeId, breakpoint, nodes }: SectionProps) {
  const patchNode = useEditorStore((state) => state.patchNode);
  const node = nodes[nodeId];

  const setValue = useCallback(
    (field: StyleField, next: unknown) => {
      patchNode(nodeId, (draft) => {
        const styles = draft.styles as unknown as Record<string, Record<string, unknown> | undefined>;
        const existing = styles[field.key];
        if (next === undefined) {
          if (existing) delete existing[breakpoint];
        } else {
          styles[field.key] = { ...(existing ?? {}), [breakpoint]: next };
        }
      });
    },
    [nodeId, patchNode, breakpoint],
  );

  const parse = useCallback(
    (field: StyleField, raw: string): unknown => {
      const trimmed = raw.trim();
      if (!trimmed) return undefined;
      if (field.kind === 'number') {
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : undefined;
      }
      if (field.kind === 'length') {
        if (trimmed === 'auto') return 'auto';
        const m = trimmed.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|pct|vh|vw)$/);
        if (m) return { kind: m[2] as Length['kind'], value: Number(m[1]) };
        const plain = Number(trimmed);
        if (Number.isFinite(plain)) return { kind: 'px', value: plain };
        return undefined;
      }
      return trimmed;
    },
    [],
  );

  const format = useCallback((field: StyleField, value: unknown): string => {
    if (value === undefined || value === null) return '';
    if (field.kind === 'number') return String(value);
    if (field.kind === 'length') {
      if (value === 'auto') return 'auto';
      const v = value as Length;
      return lengthToCss(v);
    }
    return String(value);
  }, []);

  return (
    <section className="border-t border-slate-800 pt-4 pb-2 first:border-t-0 first:pt-0">
      <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </h3>
      <div className="divide-y divide-slate-800/50">
        {fields.map((field) => {
          const responsive = node?.styles[field.key] as Responsive<unknown> | undefined;
          const current = resolveResponsive(breakpoint, responsive);
          // Override dots are shown only on tablet and mobile, never on desktop.
          const overridden = breakpoint !== 'desktop' && responsive !== undefined && breakpoint in responsive;
          return (
            <div
              key={field.key}
              className="px-2 flex items-center gap-2"
            >
              <label
                className="w-24 shrink-0 text-xs text-slate-400 leading-6"
                title={field.label}
              >
                {field.label}
              </label>
              <input
                className="flex-1 shrink-0 w-0 rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none transition-colors"
                value={format(field, current)}
                placeholder={field.placeholder}
                onChange={(e) => setValue(field, parse(field, e.target.value))}
                title={field.label}
              />
              {overridden && (
                <>
                  <span
                    className="w-1.5 h-1.5 shrink-0 rounded-full bg-cyan-500"
                    title={`Override at ${breakpoint}`}
                    aria-hidden="true"
                  />
                  <button
                    onClick={() => setValue(field, undefined)}
                    className="w-6 h-6 shrink-0 rounded-md border border-slate-700 bg-slate-900 text-slate-400 flex items-center justify-center text-[10px] hover:bg-slate-800 hover:text-slate-200"
                    title="Reset to base"
                    aria-label={`Reset ${field.label} to base`}
                  >
                    <RotateCw size={10} strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Inspector() {
  const breakpoint = useEditorStore((state) => state.breakpoint);
  const nodes = useEditorStore((state) => state.nodes);
  const selection = useEditorStore((state) => state.selection);

  const selectedId = selection.length > 0 ? (selection[0] ?? null) : null;
  const node = selectedId ? nodes[selectedId] : undefined;

  if (!selectedId || !node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500">
        <span className="w-8 h-8 shrink-0 rounded-full border border-slate-700 flex items-center justify-center text-slate-600 mb-2">
          <RotateCw size={14} strokeWidth={2} />
        </span>
        <p className="text-sm font-medium text-slate-300">Select a node</p>
        <p className="text-xs mt-1 text-slate-600">Click a layer in the tree or canvas to edit its styles.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <Section title="Layout" fields={LAYOUT} nodeId={selectedId} breakpoint={breakpoint} nodes={nodes} />
      <Section title="Typography" fields={TYPOGRAPHY} nodeId={selectedId} breakpoint={breakpoint} nodes={nodes} />
      <Section title="Colors" fields={COLORS} nodeId={selectedId} breakpoint={breakpoint} nodes={nodes} />
      <Section title="Spacing" fields={SPACING} nodeId={selectedId} breakpoint={breakpoint} nodes={nodes} />
    </div>
  );
}
