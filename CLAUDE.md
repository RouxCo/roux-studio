# Roux Studio

Local-first visual website builder for Roux and Co. Repo: this directory.

## Sources — do not dump these into context

- Plan: `docs/PLAN.md` — grep for the milestone or section you need; never read the whole file.
- Decisions: `DECISIONS.md` — log every spec deviation here (date, decision, alternatives, reason).
- Do not read the full build spec, `docs/PLAN.md`, `research/RESEARCH.md` or `CHANGELOG.md` unless a task names a specific section. Grep first, then read only that section.

## Binding rules

- Breakpoints: CSS is desktop-first. Tablet `@media (max-width: 1023px)`, mobile `@media (max-width: 767px)`. Canvas iframe widths: 1440 / 768 / 390.
- Export must not emit inline `style` attributes. Styles come from compiled classes (`r-{hash}`).
- Copy uses "we", not "I". Run `avoid-ai-writing` on any user-facing copy. No lorem ipsum, no real client names or numbers.

## How to work here

Follow the global "Working rules for this model" in `~/.claude/CLAUDE.md`: small jobs, subagents, commit after each job, run `pnpm build` (type-check) and `pnpm test` before claiming done.
