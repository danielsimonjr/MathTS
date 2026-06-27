# @danielsimonjr/mathts-workbook

Headless runtime for MathTS scientific notebooks in the YAML-based `.mtsw` format. Load a workbook, run its cells in dependency order, and verify results — all from the terminal or programmatically.

> **Scope:** This is the headless v1 — a CLI and runtime. Code cells evaluate **MathTS expressions** (via the sandboxed expression engine), not arbitrary TypeScript. A desktop GUI is a separate, later project that builds on this runtime.

## Installation

```bash
npm install @danielsimonjr/mathts-workbook
```

## CLI

```bash
# Run a workbook: executes cells in dependency order and prints per-cell results.
# Exits non-zero if any cell errors or any test assertion fails.
mtsw run example.mtsw
mtsw run example.mtsw -v        # also print the execution event stream
mtsw run example.mtsw --json    # machine-readable envelope on stdout
mtsw run example.mtsw -c gauss  # run one cell + its transitive deps (stateless)

# Describe the structured document model (cells, outputs, dependency graph).
mtsw describe example.mtsw --json

# Validate structure: ids, dependency references, and cycles.
mtsw validate example.mtsw [--json]

# Print the dependency graph (human only; use `describe --json` for structured data).
mtsw graph example.mtsw                 # text adjacency
mtsw graph example.mtsw -f mermaid      # Mermaid `graph TD`

# Engine introspection (for tooling / GUIs).
mtsw capabilities --json                # version, supported cell types, feature flags
mtsw templates --json                   # available `new` templates

# Scaffold a new workbook (<name>.mtsw) from a template.
mtsw new my-notebook                    # basic template; refuses to overwrite
mtsw new my-notebook -t basic --force   # overwrite an existing file

# Strip cell outputs (for git): prints to stdout, or -w to rewrite in place.
mtsw strip example.mtsw
mtsw strip example.mtsw -w

# Run and persist outputs back into the file (opt-in; never writes without --write).
mtsw run example.mtsw --write
```

Diagnostics and errors are written to stderr; results (including `--json`) go to stdout, so the exit code can be used in scripts independently of the output.

**Machine contract (`--json`).** Every `--json` command emits one envelope on stdout:
`{ schemaVersion: {major,minor}, command, ok, data, problems }`. The envelope is
emitted even on failure (and is cycle/BigInt-safe, so it never crashes on
pathological data); the exit code mirrors `ok` for shells, but tooling/GUIs
should read `ok` and treat a missing/unparseable envelope as the only transport
error. Compatibility rule: ignore unknown fields when `major` matches; refuse on
a `major` mismatch. `run --cell <id>` is stateless (it recomputes the target's
transitive deps each call; `run --cell --write` persists only the executed
cells). This is the contract a GUI binds to; a persistent `serve` mode (streaming
events, incremental re-execution) is planned.

**Saving / round-trip.** `serializeWorkbook` (and the write commands above) round-trips a workbook through the parser: structure is preserved exactly, and persisted `output` values round-trip best-effort (plain numbers/strings/arrays/objects exactly; exotic types to their plain shape). All writes are **atomic** (temp file + rename). Note that any write path is parse→serialize and therefore **drops YAML comments and re-orders keys** — a CST-preserving in-place rewrite is a future enhancement.

## Programmatic API

```typescript
import { parseWorkbook, createExecutor, formatResult } from '@danielsimonjr/mathts-workbook';

const content = `
version: "1.0"
metadata:
  title: "My Workbook"
runtime:
  engine: mathts
  execution: reactive
cells:
  - code: "n * (n + 1) / 2"
    id: gaussSum
    depends_on: [n]
  - code: "10"
    id: n
  - test: "gaussSum == 55"
    id: checkGauss
    depends_on: [gaussSum]
`;

const result = parseWorkbook(content);
if (result.success && result.workbook) {
  const report = await createExecutor(result.workbook).runReport();
  for (const cell of report.cells) {
    console.log(cell.id, cell.status, formatResult(cell.output));
  }
  console.log('ok:', report.ok);
}
```

`runReport()` is continue-on-error and returns a structured `RunResult` (it never throws on a cell failure, and refuses a workbook with a dependency cycle). The older `runAll()` remains available as an event-stream API that throws on the first cell error.

## Workbook format (.mtsw)

```yaml
version: '1.0'
metadata:
  title: 'Example'
  author: 'Your Name'

runtime:
  engine: mathts
  execution: reactive # reactive | sequential | manual

cells:
  - markdown: |
      # Introduction
    id: intro

  - code: '{ pi: 3.14159, e: 2.71828 }'
    id: constants

  - test: 'constants.pi > 3.14'
    id: checkPi
    depends_on: [constants]
```

Each cell is a YAML mapping with **exactly one** type key (`code`, `markdown`, `data`, `test`, …) whose value is the cell content, plus:

- **`id`** (required) — must be a valid identifier (`[A-Za-z_][A-Za-z0-9_]*`); ids are how cells are referenced.
- **`depends_on`** (optional) — a list of cell ids this cell depends on.

### Dependencies & scope

A dependency's result is injected into a cell's evaluation scope as a variable named by the dependency's id. To expose several values, return an object literal and read it with property access:

```yaml
cells:
  - code: '{ n: 2, m: 3 }'
    id: pair
  - code: 'pair.n + pair.m' # -> 5
    id: total
    depends_on: [pair]
```

Scope is **direct-only (non-transitive)**: a cell sees only the cells in its own `depends_on`, not their dependencies. To use a transitive value, list it explicitly.

### Test cells

A `test` cell's expression must evaluate to a **boolean**: `true` passes, `false` fails, and a non-boolean result is reported as an error (use an explicit comparison). A failing test makes `mtsw run` exit non-zero — workbooks can verify themselves.

## Cell types (v1)

| Type       | Status | Description                                                  |
| ---------- | ------ | ------------------------------------------------------------ |
| `markdown` | ✅     | Documentation (passed through verbatim)                      |
| `code`     | ✅     | MathTS expression script; last value is the result          |
| `data`     | ✅     | Structured YAML, parsed (hardened) into a value             |
| `test`     | ✅     | Boolean assertion (`true` = pass)                            |
| `tensor` / `equation` / `visualization` / `export` | ⏳ | Reserved; not executed in v1 (reported as unsupported) |

## Execution modes

- **reactive** — emits stale events for dependents when a cell re-runs
- **sequential** — top-to-bottom (dependency) order
- **manual** — explicit trigger only

## Security

Code and test cells execute only through the MathTS sandboxed expression engine — no `eval`, `Function`, or `vm`. YAML (both the document and `data`-cell payloads) is parsed with a hardened core-schema configuration and a prototype-pollution guard.

## License

MIT
