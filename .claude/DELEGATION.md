# Claude Supervisor — Delegation Tracker

**Project:** Roux Studio  
**Delegatee:** Claude Code CLI (`claude`)  
**Delegator:** Hermes Agent  
**Workspace:** `/home/user/Claude-Outbox/projects/roux-studio/`  
**Modes:** Print mode (`claude -p`) for one-shot; tmux + interactive for multi-turn  
**Status:** Active

---

## Delegation Rules

- Hermes Agent assigns tasks; Claude Code executes
- Claude Code reports results via tool output
- Hermes Agent reviews, verifies (build + tests), and commits
- No destructive commands without explicit user approval
- All work committed to `main` branch at milestone boundaries

---

## Task Queue

| # | Task | Milestone | Status | Assigned | Completed |
|---|------|-----------|--------|----------|-----------|
| 1 | Scaffold + data model + store | M1 Foundation | Done | Hermes | 2026-11-16 |
| 2 | Zustand + Immer undo/redo (cap 200) | M1 Foundation | Done | Hermes | 2026-11-16 |
| 3 | IndexedDB stores (projects + assets) | M1 Foundation | Done | Hermes | 2026-11-16 |
| 4 | BroadcastChannel multi-tab guard skeleton | M1 Foundation | Done | Hermes | 2026-11-16 |
| 5 | Canvas renderer + element registry | M2 | Done | Claude Code | 2026-11-17 |
| 6 | Editor shell + interactions | M3 | Done | Claude Code | 2026-11-19 |
| 7 | Responsive + styles + blocks + templates | M4 | Done | Claude Code | 2026-11-17 |
| 8 | Export pipeline + pre-export checks | M5 | Done | Claude Code | 2026-11-18 |
| 9 | Import/export + multi-tab + polish | M6 | In progress | Claude Code | — |

---

## Active Tasks (Current)

None currently assigned.

---

## Completed Work

| Date | Task | Result |
|------|------|--------|
| 2026-11-16 | M1 Foundation complete | 24 tests passing, build clean |
| 2026-11-17 | M2 canvas renderer + M4 styles/blocks/templates | M4 sign-off: export check passes for all four templates |
| 2026-11-18 | M5 export pipeline Jobs 1–9 | Export dialog, SEO panel, pages manager, pre-export checks, .roux.zip import/export |
| 2026-11-19 | Multi-select + drag-to-move (M3 editor interactions) | 432 tests passing, build clean |
| 2026-11-19 | Asset manager: cleanUnusedAssets orphan collection | 432 tests passing, build clean |
| 2026-11-19 | Multi-tab take-over banner (MultiTabGuard) | 436 tests passing, build clean |

---

## Known Issues / Watchlist

- `c-{hash}` CSS dedupe — deferred to M5
- Pre-export size/contrast/font checks — deferred (need asset metadata)
- Multi-page manager UI — deferred to M5
- Desktop app GPU crash (`error_code=1002`) — affects previews only, not CLI
- `state.db` corruption — resolved 2026-11-19 07:51 (killed PID 172915, gateway restarted)

---

## Delegation Commands

To delegate a task to Claude Code:

```bash
# Print mode (one-shot, preferred)
claude -p "<task description>" --allowedTools "Read,Edit,Write,Bash" --max-turns 10
  workdir="/home/user/Claude-Outbox/projects/roux-studio"

# Interactive multi-turn (tmux)
tmux new-session -d -s claude-studio -x 140 -y 40
tmux send-keys -t claude-studio 'cd /home/user/Claude-Outbox/projects/roux-studio && claude' Enter
```

**Never** use `--dangerously-skip-permissions`. Always use explicit `--allowedTools`.

---

## Communication Loop

1. Hermes Agent writes task → `claude -p "..."`
2. Claude Code executes → returns result
3. Hermes Agent verifies → `pnpm build` + `pnpm test`
4. Hermes Agent commits → `git commit -m "feat(scope): ..."`
5. Hermes Agent updates this tracker
