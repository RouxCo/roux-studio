// Roux Studio — tokens panel in the left sidebar.
//
// Lists design tokens grouped by type (Colours, Spacing, Lengths, Numbers).
// Each row shows a colour swatch (colours only), an inline-editable name
// (rename on blur/Enter), a value input (updateToken on blur/Enter) and a
// delete button. Deleting a token that's still in use offers "Replace with…"
// (other tokens of the same type) or "Detach all".
//
// "+ Add token" collects a name, type and value, then calls addToken. Names
// must be lowercase kebab-case and unique; an inline error shows otherwise.
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useEditorStore, tokenUsage } from '../store/useEditorStore';
import type { DesignToken } from '../types';

type TokenType = DesignToken['type'];

const TYPE_LABELS: Record<TokenType, string> = {
  color: 'Colours',
  spacing: 'Spacing',
  length: 'Lengths',
  number: 'Numbers',
};

const TYPE_ORDER: TokenType[] = ['color', 'spacing', 'length', 'number'];

const KEBAB = /^[a-z][a-z0-9-]*$/;

function groupByType(
  byName: Record<string, DesignToken>,
): Record<TokenType, DesignToken[]> {
  const groups: Record<TokenType, DesignToken[]> = {
    color: [],
    spacing: [],
    length: [],
    number: [],
  };
  for (const token of Object.values(byName)) {
    groups[token.type].push(token);
  }
  for (const type of TYPE_ORDER) {
    groups[type].sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}

function isValidName(name: string): boolean {
  return KEBAB.test(name);
}

export default function TokensPanel() {
  const byName = useEditorStore((state) => state.tokens.byName);
  const nodes = useEditorStore((state) => state.nodes);
  const addToken = useEditorStore((state) => state.addToken);
  const updateToken = useEditorStore((state) => state.updateToken);
  const renameToken = useEditorStore((state) => state.renameToken);
  const deleteToken = useEditorStore((state) => state.deleteToken);

  const groups = groupByType(byName);

  // "Add token" form state
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState<TokenType>('color');
  const [addValue, setAddValue] = useState('');
  const [addError, setAddError] = useState('');

  // Inline rename state
  const [renameName, setRenameName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Inline value-edit state: token name → draft value
  const [editValue, setEditValue] = useState<Record<string, string | undefined>>({});

  // Delete confirmation state
  const [deleting, setDeleting] = useState<string | null>(null); // token being deleted
  const [deleteReplace, setDeleteReplace] = useState(''); // replacement token name

  const saveName = (original: string) => {
    const next = renameValue.trim();
    if (!next || next === original) {
      setRenameName(null);
      setRenameValue('');
      return;
    }
    if (!isValidName(next)) return;
    if (byName[next]) return;
    renameToken(original, next);
    setRenameName(null);
    setRenameValue('');
  };

  const saveValue = (name: string) => {
    const next = editValue[name];
    if (next === undefined) return;
    updateToken(name, next);
    setEditValue({ ...editValue, [name]: undefined });
  };

  const handleDelete = (name: string) => {
    const token = byName[name];
    if (!token) return;
    if (tokenUsage(nodes, name) === 0) {
      deleteToken(name, 'detach');
      setDeleting(null);
      setDeleteReplace('');
      return;
    }
    const sameType = groups[token.type].filter((t) => t.name !== name);
    setDeleteReplace(sameType.length > 0 ? sameType[0]!.name : '');
    setDeleting(name);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    if (deleteReplace) {
      deleteToken(deleting, { replaceWith: deleteReplace });
    } else {
      deleteToken(deleting, 'detach');
    }
    setDeleting(null);
    setDeleteReplace('');
  };

  const addTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!isValidName(addName)) {
      setAddError('Use lowercase kebab-case (e.g. color-primary).');
      return;
    }
    if (byName[addName]) {
      setAddError('A token with that name already exists.');
      return;
    }
    addToken({ name: addName, value: addValue, type: addType });
    setAdding(false);
    setAddName('');
    setAddValue('');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 flex items-center gap-2 border-b border-slate-800">
        <Plus size={14} strokeWidth={2} />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Tokens</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {TYPE_ORDER.map((type) => {
          const tokens = groups[type];
          if (tokens.length === 0) return null;
          return (
            <div key={type}>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                {TYPE_LABELS[type]}
              </h3>
              <div className="space-y-1.5">
                {tokens.map((token) => (
                  <TokenRow
                    key={token.name}
                    token={token}
                    usage={tokenUsage(nodes, token.name)}
                    isRenaming={renameName === token.name}
                    renameValue={renameValue}
                    editValue={editValue[token.name] ?? token.value}
                    onStartRename={() => {
                      setRenameName(token.name);
                      setRenameValue(token.name);
                    }}
                    onSaveName={(next: string) => {
                      setRenameValue(next);
                    }}
                    onCommitRename={() => saveName(token.name)}
                    onCancelRename={() => {
                      setRenameName(null);
                      setRenameValue('');
                    }}
                    onChangeValue={(next: string) => {
                      setEditValue({ ...editValue, [token.name]: next });
                    }}
                    onCommitValue={() => saveValue(token.name)}
                    onCancelValue={() => {
                      setEditValue({ ...editValue, [token.name]: undefined });
                    }}
                    onDelete={() => handleDelete(token.name)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-shrink-0 border-t border-slate-800 p-3">
        {adding ? (
          <form onSubmit={addTokenSubmit} className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <input
                className="px-2 py-1.5 text-sm bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="name (kebab-case)"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
              <select
                className="px-2 py-1.5 text-sm bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                value={addType}
                onChange={(e) => setAddType(e.target.value as TokenType)}
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <input
                className="px-2 py-1.5 text-sm bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="value"
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
              />
            </div>
            {addError && (
              <p className="text-[10px] text-red-400">{addError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setAddName('');
                  setAddValue('');
                  setAddError('');
                }}
                className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                className="px-2 py-1.5 text-xs text-cyan-400 hover:text-cyan-300"
              >
                Add
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full py-1.5 text-xs flex items-center justify-center gap-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
          >
            <Plus size={12} strokeWidth={2} /> Add token
          </button>
        )}
      </div>

      {deleting && (
        <div className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-md p-5 w-[320px] shadow-xl">
            <p className="text-sm text-slate-200 mb-1">
              Used by <span className="font-mono">{tokenUsage(nodes, deleting!)}</span> elements
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Replace references with another token, or detach all and keep
              raw values.
            </p>
            <label className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-400">Replace with</span>
              <select
                className="flex-1 px-2 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                value={deleteReplace}
                onChange={(e) => setDeleteReplace(e.target.value)}
              >
                <option value="">Detach all</option>
                {groups[byName[deleting!]!.type]
                  .filter((t) => t.name !== deleting)
                  .map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDeleting(null);
                  setDeleteReplace('');
                }}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300"
              >
                {deleteReplace ? 'Replace & delete' : 'Detach & delete'}
              </button>
            </div>
          </div>
        </div>
      )
      }
    </div>
  )
}

function s(n: number): string {
  return n === 1 ? '' : 's';
}

interface TokenRowProps {
  token: DesignToken;
  usage: number;
  isRenaming: boolean;
  renameValue: string;
  editValue: string;
  onStartRename: () => void;
  onSaveName: (next: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onChangeValue: (next: string) => void;
  onCommitValue: () => void;
  onCancelValue: () => void;
  onDelete: () => void;
}

function TokenRow({
  token,
  usage,
  isRenaming,
  renameValue,
  editValue,
  onStartRename,
  onSaveName,
  onCommitRename,
  onCancelRename,
  onChangeValue,
  onCommitValue,
  onCancelValue,
  onDelete,
}: TokenRowProps) {
  const isColor = token.type === 'color';
  const [hovered, setHovered] = useState(false);

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelRename();
    }
  };

  const handleValueKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommitValue();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelValue();
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-transparent transition hover:bg-slate-800/50"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isColor ? (
        <div
          className="w-5 h-5 rounded border border-slate-700 shrink-0"
          style={{ backgroundColor: token.value }}
          title={token.value}
        />
      ) : (
        <div className="w-5 h-5 shrink-0" />
      )}
      {isRenaming ? (
        <input
          className="flex-1 px-2 py-1 text-sm bg-slate-950 text-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
          value={renameValue}
          onChange={(e) => onSaveName(e.target.value)}
          onBlur={onCommitRename}
          onKeyDown={handleNameKeyDown}
          autoFocus
        />
      ) : (
        <span
          onClick={onStartRename}
          className="flex-1 truncate text-sm text-slate-300 hover:underline cursor-select-none"
          title={token.name}
        >
          {token.name}
        </span>
      )}
      <input
        className="w-[110px] px-2 py-1 text-xs font-mono bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        value={editValue}
        onChange={(e) => onChangeValue(e.target.value)}
        onBlur={onCommitValue}
        onKeyDown={handleValueKeyDown}
      />
      {usage > 0 && (
        <span className="text-[10px] font-mono text-slate-500 shrink-0 whitespace-nowrap">
          {usage} use{s(usage)}
        </span>
      )}
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-6 h-6 shrink-0 items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10"
          title="Delete token"
        >
          <Trash2 size={12} strokeWidth={2} />
        </button>
      )}
      {!hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-6 h-6 shrink-0 opacity-0 items-center justify-center rounded"
          title="Delete token"
        >
          <Trash2 size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
