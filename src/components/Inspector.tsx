// Roux Studio — right-hand Inspector panel.
//
// Edits the selected node's ResponsiveStyles for the active breakpoint through
// useEditorStore. Each control shows the value resolved at the active breakpoint
// (desktop-first: mobile ?? tablet ?? desktop) and marks an explicit breakpoint
// override with a dot. Clicking reset removes that override so the value falls
// back to the base/default. With nothing selected, an empty state is shown.
import { useCallback, useState } from 'react';
import { Blocks, RotateCw, Tag } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import type { DesignToken, Node, NodeId, Breakpoint, Length, ResponsiveStyles } from '../types';
import { resolveStyle } from '../compile/resolveStyle';
import { lengthToCss } from '../canvas/renderNode';
import BackgroundPanel from './BackgroundPanel';

type Kind = 'length' | 'number' | 'text';

interface StyleField {
  key: keyof ResponsiveStyles;
  label: string;
  kind: Kind;
  placeholder?: string;
  tokenType?: 'color' | 'length' | 'spacing';
}

const LAYOUT: StyleField[] = [
  { key: 'display', label: 'Display', kind: 'text', placeholder: 'flex | block | grid | none' },
  { key: 'width', label: 'Width', kind: 'length', placeholder: 'e.g. 100%', tokenType: 'length' },
  { key: 'height', label: 'Height', kind: 'length', placeholder: 'e.g. auto', tokenType: 'length' },
  { key: 'flexDirection', label: 'Flex direction', kind: 'text', placeholder: 'row | column' },
  { key: 'justifyContent', label: 'Justify content', kind: 'text', placeholder: 'flex-start | center | space-between' },
  { key: 'alignItems', label: 'Align items', kind: 'text', placeholder: 'stretch | center | flex-start' },
  { key: 'position', label: 'Position', kind: 'text', placeholder: 'static | relative | absolute' },
  { key: 'overflow', label: 'Overflow', kind: 'text', placeholder: 'visible | hidden | auto | scroll' },
];

const TYPOGRAPHY: StyleField[] = [
  { key: 'fontFamily', label: 'Font family', kind: 'text', placeholder: 'e.g. Inter' },
  { key: 'fontSize', label: 'Font size', kind: 'length', placeholder: 'e.g. 16px', tokenType: 'length' },
  { key: 'fontWeight', label: 'Font weight', kind: 'number', placeholder: 'e.g. 400' },
  { key: 'lineHeight', label: 'Line height', kind: 'text', placeholder: 'e.g. 1.5' },
  { key: 'letterSpacing', label: 'Letter spacing', kind: 'text', placeholder: 'e.g. 0px' },
  { key: 'textAlign', label: 'Text align', kind: 'text', placeholder: 'left | center | right' },
  { key: 'textTransform', label: 'Text transform', kind: 'text', placeholder: 'none | uppercase | lowercase' },
];

const COLORS: StyleField[] = [
  { key: 'color', label: 'Color', kind: 'text', placeholder: '#hex', tokenType: 'color' },
  { key: 'backgroundColor', label: 'Background', kind: 'text', placeholder: '#hex', tokenType: 'color' },
  { key: 'opacity', label: 'Opacity', kind: 'number', placeholder: '0..1' },
];

const SPACING: StyleField[] = [
  { key: 'margin', label: 'Margin', kind: 'length', placeholder: 'e.g. 16px', tokenType: 'spacing' },
  { key: 'padding', label: 'Padding', kind: 'length', placeholder: 'e.g. 24px', tokenType: 'spacing' },
  { key: 'gap', label: 'Gap', kind: 'length', placeholder: 'e.g. 8px', tokenType: 'spacing' },
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

  const tokens = useEditorStore((state) => state.tokens.byName);
  const addToken = useEditorStore((state) => state.addToken);
  const beginBatch = useEditorStore((state) => state.beginBatch);
  const endBatch = useEditorStore((state) => state.endBatch);
  const [openField, setOpenField] = useState<string | null>(null);

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
          const current = node ? resolveStyle(node, breakpoint, field.key) : undefined;
          // Override dots are shown only on tablet and mobile, never on desktop.
          const overridden =
            breakpoint !== 'desktop' && node !== undefined && node.styles[field.key]?.[breakpoint] !== undefined;

          // The name of the design token behind `value`, or null when it is a raw value.
          const refName = tokenRef(field, current);
          const token = refName ? tokens[refName] : undefined;

          /** Tokens this field can reference: colours for colour fields, spacing & length for length fields. */
          const matchingTokens = (): DesignToken[] => {
            const all = Object.values(tokens);
            return field.kind === 'text'
              ? all.filter((t) => t.type === 'color')
              : all.filter((t) => t.type === 'spacing' || t.type === 'length');
          };

          function tokenRef(field: StyleField, value: unknown): string | null {
            if (field.kind === 'text') {
              if (typeof value === 'string') {
                const m = value.match(/^var\(--([a-zA-Z0-9_-]+)\)$/);
                if (m) return m[1] ?? null;
              }
              return null;
            }
            if (field.kind === 'length' && typeof value === 'object' && value !== null) {
              const v = value as Length;
              if (v.kind === 'token') return v.token ?? null;
            }
            return null;
          }

          function pickToken(token: DesignToken) {
            const ref: unknown =
              field.kind === 'text' ? `var(--${token.name})` : { kind: 'token', value: 0, token: token.name };
            setValue(field, ref);
            setOpenField(null);
          }

          function detachToken() {
            if (!refName) return;
            const t = tokens[refName]!;
            const next: unknown = field.kind === 'length' ? parse(field, t.value) : t.value;
            setValue(field, next);
            setOpenField(null);
          }

          function promptTokenName(): string | null {
            let name = window.prompt('Name the token (kebab-case, e.g. space-8)', '');
            while (name !== null && !/^[a-z][a-z0-9-]*$/.test(name.trim())) {
              window.alert('Token names must be kebab-case (lowercase letters, numbers, hyphens).');
              name = window.prompt('Name the token (kebab-case, e.g. space-8)', '');
            }
            return name === null ? null : name.trim();
          }

          function createToken() {
            if (current === undefined || current === null) return;
            const name = promptTokenName();
            if (name === null) return;
            const type = field.kind === 'text' ? 'color' : (field.tokenType ?? 'length');
            const ref: unknown =
              field.kind === 'text' ? `var(--${name})` : { kind: 'token', value: 0, token: name };
            beginBatch();
            addToken({ name, value: format(field, current), type });
            setValue(field, ref);
            endBatch();
            setOpenField(null);
          }

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
              <div className="flex-1 shrink-0 w-0 relative flex items-center gap-2">
                {refName && token ? (
                  <>
                    <span
                      className="flex-1 shrink-0 w-0 min-w-0 truncate rounded-md border border-slate-700 bg-slate-900 text-xs text-slate-400 px-2 py-1"
                      title={refName}
                    >
                      {refName}
                    </span>
                    <button
                      onClick={detachToken}
                      className="rounded-md border border-slate-700 bg-slate-900 text-slate-400 text-[10px] px-2 py-1 hover:bg-slate-800 hover:text-slate-200"
                      title="Detach token"
                      aria-label={`Detach ${field.label} token`}
                    >
                      Detach
                    </button>
                  </>
                ) : (
                  <input
                    className="flex-1 shrink-0 w-0 rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 px-2 py-1 focus:border-cyan-500 focus:outline-none transition-colors"
                    value={format(field, current)}
                    placeholder={field.placeholder}
                    onChange={(e) => setValue(field, parse(field, e.target.value))}
                    title={field.label}
                  />
                )}
                {field.tokenType !== undefined && (
                  <>
                    <button
                      onClick={() => setOpenField(openField === field.key ? null : field.key)}
                      className="w-6 h-6 shrink-0 rounded-md border border-slate-700 bg-slate-900 text-slate-400 flex items-center justify-center text-[10px] hover:bg-slate-800 hover:text-slate-200"
                      title="Design tokens"
                      aria-label="Tokens"
                    >
                      <Tag size={10} strokeWidth={2} />
                    </button>
                    {openField === field.key && (
                      <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-slate-700 bg-slate-950 text-xs text-slate-200 shadow-lg">
                        {matchingTokens().map((t) => (
                          <button
                            key={t.name}
                            onClick={() => pickToken(t)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-800"
                            title={t.name}
                          >
                            {t.name}
                          </button>
                        ))}
                        {!refName && (
                          <>
                            <div className="border-t border-slate-800/50" />
                            <button
                              onClick={createToken}
                              className="w-full text-left px-3 py-2 text-cyan-400 hover:bg-slate-800"
                            >
                              Create token from value…
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
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
  const pages = useEditorStore((state) => state.pages);
  const selection = useEditorStore((state) => state.selection);
  const setPageGlobals = useEditorStore((state) => state.setPageGlobals);
  const removeGlobalHeader = useEditorStore((state) => state.removeGlobalHeader);
  const removeGlobalFooter = useEditorStore((state) => state.removeGlobalFooter);
  const globalHeaderId = useEditorStore((state) => state.globalHeaderId);
  const globalFooterId = useEditorStore((state) => state.globalFooterId);

  const selectedId = selection.length > 0 ? (selection[0] ?? null) : null;
  const node = selectedId ? nodes[selectedId] : undefined;
  // The Page record behind the selected page node (nodes are addressed by
  // node id, pages by page id linked through Page.rootId).
  const page = selectedId ? pages.find((p) => p.rootId === selectedId) : undefined;
  const saveAsBlock = useEditorStore((state) => state.saveAsBlock);

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
      {node && (node.type === 'section' || node.type === 'container') && (
        <div className="px-2 pb-2">
          <button
            onClick={() => {
              const defaultName = `${node.type} block`;
              const name = window.prompt('Name the block', defaultName);
              if (name !== null) saveAsBlock(selectedId!, name);
            }}
            className="w-full py-2 text-xs text-slate-200 bg-slate-800 border border-slate-700 rounded-md flex items-center justify-center gap-2 hover:bg-slate-700 transition"
          >
            <Blocks size={14} strokeWidth={2} /> Save as block
          </button>
        </div>
      )}
      <Section title="Layout" fields={LAYOUT} nodeId={selectedId} breakpoint={breakpoint} nodes={nodes} />
      <Section title="Typography" fields={TYPOGRAPHY} nodeId={selectedId} breakpoint={breakpoint} nodes={nodes} />
      <Section title="Colors" fields={COLORS} nodeId={selectedId} breakpoint={breakpoint} nodes={nodes} />
      <Section title="Spacing" fields={SPACING} nodeId={selectedId} breakpoint={breakpoint} nodes={nodes} />
      {node && (node.type === 'page' || node.type === 'section') && (
        <BackgroundPanel nodeId={selectedId} />
      )}
      {node.type === 'page' && page && (
        <section className="border-t border-slate-800 pt-4 pb-2 first:border-t-0 first:pt-0">
          <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Global
          </h3>
          <div className="divide-y divide-slate-800/50 px-2">
            <div className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                checked={page.useGlobalHeader}
                onChange={(e) => setPageGlobals(page.id, { header: e.target.checked })}
              />
              <label className="text-xs text-slate-200">Use global header</label>
              {globalHeaderId && (
                <button
                  onClick={removeGlobalHeader}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-300 underline"
                  aria-label="Remove global header"
                >
                  Remove global header
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                checked={page.useGlobalFooter}
                onChange={(e) => setPageGlobals(page.id, { footer: e.target.checked })}
              />
              <label className="text-xs text-slate-200">Use global footer</label>
              {globalFooterId && (
                <button
                  onClick={removeGlobalFooter}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-300 underline"
                  aria-label="Remove global footer"
                >
                  Remove global footer
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
