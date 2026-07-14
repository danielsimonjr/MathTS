---
'@danielsimonjr/mathts-workbook': minor
---

Headless v1: the workbook runtime can now load and run `.mtsw` files end-to-end.

- **Real YAML parser** (`parseWorkbook`) replacing the placeholder — maps and validates cells (unique, identifier-safe ids; exactly one type key; existing `depends_on` references), with hardened parsing (core schema, merges off) and a prototype-pollution guard applied to both the document and `data`-cell payloads.
- **`test` cells**: boolean assertions (`true` = pass, `false` = fail with a safe message, non-boolean = error) that make a workbook self-verifying.
- **`WorkbookExecutor.runReport()`**: continue-on-error execution in dependency order returning a structured `RunResult`, with up-front cycle refusal. `runCell`/`runAll` are unchanged.
- **Working CLI** (`mtsw run`/`validate`/`graph`): reads the file, prints per-cell results (human or `--json`), routes errors to stderr, and exits non-zero on failure. `graph -f mermaid` emits a `graph TD` diagram.
- **`formatResult`** and **`toMermaid`** helpers; new `CellResult`/`RunResult` types exported.
- Dependency scope is documented as direct-only (non-transitive).
- The bundled `examples/basic-workbook.mtsw` is now an expression-style, self-verifying workbook.
