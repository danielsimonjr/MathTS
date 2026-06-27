---
"@danielsimonjr/mathts-workbook": minor
---

Machine read-contract for GUI/tooling: a stable, versioned `--json` envelope and read/introspect/targeted-run commands.

- **Unified `--json` envelope** on every machine command: `{ schemaVersion: {major,minor}, command, ok, data, problems }`. Cycle/BigInt-safe (never throws, even on YAML-anchor cycles); emitted even on failure; exit code mirrors `ok`. (`run --json` migrated into this envelope.)
- **`describe <file> [--json]`** — the structured document model (cells with content + cached output/error, dependency graph edges, problems) — the GUI "open document" call.
- **`run --cell <id>`** — run a cell and its transitive dependencies (stateless; `--write` persists only the executed cells).
- **`validate --json`**, **`capabilities [--json]`**, **`templates [--json]`** (the latter two read no file). `graph` stays human-only (structured graph lives in `describe`); a stray `graph --json` returns a directing envelope error.
- New `getAncestors(graph, id)` (topo order) and `SCHEMA_VERSION` exported; `runReport({ only })` runs a single cell's ancestor closure.
- Reviewed (Adam/Eve + code-reviewer): envelope crash-safety on circular data, `output` type unified to raw across `run`/`describe`, command-drift guard.
