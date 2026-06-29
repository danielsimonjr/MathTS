---
"@danielsimonjr/mathts-workbook": minor
---

CLI authoring ergonomics for the Workbook.

- **`mtsw import [<file>] [-o out.mtsw] [--json]`** — build a validated `.mtsw` from a JSON/YAML document (the friendly `{ metadata, cells: [{ id, type, content, dependsOn }] }` shape — the inverse of `describe --json`). Reads a file or stdin; writes atomically or to stdout. Full validation (identifier ids, uniqueness, supported types, existing deps, **dependency cycles**, prototype-pollution) via the canonical serialize→parse path.
- **`mtsw new` upgrades**: `--empty` (blank template), a `chart` template (a line-chart example), and `-o <path>` to scaffold at any location (not just a bare name in the CWD; symlink-clobber guard preserved).
- **Chart spec validation + diagnostics**: `mtsw validate` now flags malformed `visualization` specs and chart data references to unknown cells; `mtsw export` adds a visible ⚠ note to a chart whose data cell errored or didn't resolve (instead of a silent "no data").
- **`mtsw capabilities` discoverability**: now reports `cellSchemas` (per-cell-type content schema, especially the chart spec) and `import`/`export` feature flags; corrected the stale `deferred` cell-type list (equation/visualization are supported).

Motivated by driving the CLI by hand to author a document: per-cell `cell add` is the GUI's mutation API, so whole-document `import` is the natural programmatic/scripting path. New exports: `importWorkbook` (parser). Tests: workbook 241 → 252.
