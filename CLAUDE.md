## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Folder structure (mandatory)

Code is organised **by feature** under `src/features/<feature>/{views,components,data,hooks,server,lib}`, after `code-with-antonio/resonance`. Routes under `src/app/` are thin shells that import a `<FeatureView />`. Every agent MUST read `docs/agents/folder-structure.md` before creating a new file, moving a file, or writing a spec. Deviations require an ADR.

### Tailwind — no arbitrary values (mandatory)

The editor's `tailwindcss(suggestCanonicalClasses)` warning is a hard rule, not a nag. **Do not ship `className` strings containing `[...]` arbitrary values** — not for colors, spacing, radius, font-size, line-height, letter-spacing, shadow, or anything else — when a canonical class or project token exists.

- **Colors.** Use the brand tokens exposed in `src/app/globals.css` (`@theme inline`): `rouge`, `crimson`, `rose`, `blush`, `navy-deep`, `navy-80`, `steel-blue`, `ice-blue`, `off-white`, `fog`, `fog-light`, `slate`, `slate-mute`, `ink`, `ink-deep`. Never write `bg-[#CC1627]` — write `bg-rouge`. If a hex you need is missing, add a new `--color-*` to `globals.css` with a one-line comment, then use it.
- **Spacing / sizing.** Prefer Tailwind's canonical scale (`w-4`, `h-11`, `px-6`, `py-14`, `gap-3.5`, `rounded-2xl`, …). Pick the nearest canonical step; a 1–2px drift is fine. Arbitrary pixel values are only acceptable when a design dimension has no reasonable canonical equivalent AND matters (e.g. a 42px pill height) — and even then, prefer refactoring the design to the nearest canonical step.
- **Typography.** Use `text-sm`, `text-base`, `font-semibold`, `tracking-wide`, etc. Reserve `text-[clamp(...)]` only for responsive-headline clamps that have no canonical analogue.
- **Opacity / translucency.** Use slash shorthand (`bg-white/10`, `text-navy-deep/60`), not `bg-[rgba(...)]`.

When touching a file, clean its arbitraries as you go. New components ship with zero `[...]` by default.
