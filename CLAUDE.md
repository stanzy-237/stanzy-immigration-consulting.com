## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Folder structure (mandatory)

Code is organised **by feature** under `src/features/<feature>/{views,components,data,hooks,server,lib}`, after `code-with-antonio/resonance`. Routes under `src/app/` are thin shells that import a `<FeatureView />`. Every agent MUST read `docs/agents/folder-structure.md` before creating a new file, moving a file, or writing a spec. Deviations require an ADR.
