# Workbook Headless v1 — Design Spec

**Status:** Draft (awaiting peer review + user sign-off)
**Package:** `@danielsimonjr/mathts-workbook`
**Scope:** Headless (CLI/terminal) runtime for `.mtsw` notebooks. No GUI. First slice of a larger workbench; the Electron+Vite+React+TS GUI is a later phase that will sit on top of this engine.

---

## 1. Goal

Make `@danielsimonjr/mathts-workbook` actually **load and run a `.mtsw` file from the terminal**, producing real per-cell output, with **self-verifying `test` cells** and `validate` / `graph` commands. This is "Approach 2 — Core + self-verifying": the smallest version that is a genuinely useful headless tool, not just a demo.

The runtime's execution engine already works for a `Workbook` *object*; the blocking gap is that it cannot **load** a `.mtsw` file (the YAML parser is a placeholder) and the CLI never reads the file or prints results.

## 2. Background — current state (verified from source)

- `executor.ts` — **works**. `executeCode` runs each code cell through `evaluate(content, scope)` (the sandboxed MathTS expression engine), injecting each dependency's output into scope as a variable named by the dependency's cell id. Handles `code`, `markdown` (passthrough), `data` (`parseYaml`). All other types throw `Unsupported cell type: X`. `runCell` **throws on error** (asserted by tests). Reactive mode emits `cell:stale` for dependents.
- `graph.ts` — **works**. `buildDependencyGraph`, `topologicalSort`, `getDependents`, `detectCycles` all implemented and tested.
- `parser.ts` — **placeholder**. `parseWorkbook` returns a default workbook with **zero cells** regardless of input; `serializeWorkbook` throws "not yet implemented"; `stripOutputs` and `detectCellType` work and are tested.
- `cli.ts` — **stub**. `runCommand` has `const content = ''` (never reads the file) and only logs event *types*, never actual results. `validate`/`graph`/`new` are TODO stubs.
- Existing **parser tests assert the stub** (`parseWorkbook('some content')` ⇒ success with `cells: []`; `serializeWorkbook` ⇒ throws). These must be rewritten.
- The `examples/basic-workbook.mtsw` example is written as **TypeScript** (`const`, `for`, `console.log`, `export {}`, `import {x} from '#cell'`) — none of which runs under the MathTS expression engine. It must be replaced with expression-style cells.
- `yaml@^2.3.0` is already a declared dependency; `@types/node` is a devDependency.

## 3. Locked decisions (from brainstorming)

1. **Headless v1** — no Electron/React. GUI deferred to a later phase.
2. **Lives in the existing `@danielsimonjr/mathts-workbook` package** (extend in-place).
3. **Code cells are MathTS-expression scripts** run through the existing sandboxed `evaluate()` — NOT TypeScript. This keeps v1 inside the repo's mandatory-sandbox security invariant (no `Function`/`vm`/`eval`).

## 4. Architecture & data flow

```
.mtsw file ──readFileSync──▶ parseWorkbook(content) ──▶ ParseResult{ workbook: Workbook{cells[]} }
                                                              │
                                              createExecutor(workbook)
                                                              │
                                       runReport()  ── topological order, continue-on-error ──▶ per cell:
                                          code     → evaluate(content, scope)        (sandboxed)
                                          test     → evaluate(content, scope); truthy? pass : fail
                                          data     → parseYaml(content)
                                          markdown → content (passthrough)
                                          (other)  → recorded error "Unsupported cell type"
                                                              │
                                       RunResult{ cells: CellResult[], ok } ──▶ formatResult ──▶ stdout / --json
                                                              │
                                            exit 0 (all ok) / 1 (any error or test failure)
```

## 5. `.mtsw` format contract (what the parser accepts)

Top-level YAML document:

```yaml
version: "1.0"            # optional; default "1.0"
metadata:                 # optional
  title: "..."
  author: "..."
  description: "..."
  tags: [..]
runtime:                  # optional; defaults engine=mathts, execution=reactive
  engine: mathts
  execution: reactive     # reactive | sequential | manual
cells:                    # required: a list
  - code: "x = 10"        # exactly ONE type key per cell
    id: x                 # required
  - code: "x * 2"
    id: y
    depends_on: [x]       # optional
  - test: "y == 20"
    id: checkY
    depends_on: [y]
```

**Reserved (non-type) cell keys** — excluded from `metadata`: `id`, `depends_on`, `language`, `format`. Everything else that is not a recognized type key goes into `metadata`.

**YAML hardening (security):** parse with the **core schema, merges disabled** — `parse(content, { schema: 'core', merge: false })` — so no custom/JS tags are honored. After parsing, **reject any object containing a `__proto__`, `constructor`, or `prototype` own key** (prototype-pollution guard), for both the top-level document and every `data`-cell payload. This matches the repo's defense-in-depth security posture.

**Parser validation rules (all violations collected into `ParseResult.errors`, not thrown):**

- empty/whitespace/non-string **input string** ⇒ error (`'Empty workbook content'` / the defensive `catch`), preserving existing behavior.
- `cells` must be a list. Missing/empty ⇒ valid workbook with no cells (a warning, not an error).
- Each cell must have an `id`.
- Cell ids must be **unique**.
- Cell ids must be **valid MathTS identifiers**: `/^[A-Za-z_][A-Za-z0-9_]*$/`. (This is what makes by-id dependency references work; it matches the ids the executor tests already use.)
- Each cell must have **exactly one** recognized type key (one of `markdown`/`code`/`tensor`/`equation`/`visualization`/`data`/`test`/`export`). **Zero recognized type keys ⇒ error; more than one ⇒ error** (no silent precedence-picking in file parsing — `detectCellType`'s precedence is kept only as a tiebreaker helper, but the parser treats >1 as invalid). Content = the string value of that key.
- Every entry in `depends_on` must reference an existing cell id.
- Cycles are **not** a parse error (the parser builds cells only); they are caught at run/validate time via `detectCycles`.

**Validation gates graph construction:** the executor / graph helpers are only invoked when `ParseResult.success === true`. A failed parse never reaches `buildDependencyGraph` (an edge to a non-existent node must be impossible by the time the graph is built).

## 6. Execution & dependency semantics

- **code**: `evaluate(content, scope)` — a MathTS expression script (the engine supports multi-statement scripts with assignments; the last value is the result). Unchanged from today.
- **Dependencies (direct-only, NON-TRANSITIVE)**: for each id in `cell.dependsOn`, inject `scope[id] = <that cell's result>`. **Transitivity is NOT provided**: if `a depends_on b` and `b depends_on c`, then `a` sees `b` but **not** `c` — to use `c` in `a`, list it explicitly in `a`'s `depends_on`. A reference to an id that is not injected produces a normal cell error (caught and reported), not a crash. To expose multiple named values, a cell returns an object literal (`{ n: ..., sum: ... }`); downstream cells use sandboxed property access (`dep.n`). (Behavior unchanged from today; the spec documents it, and the README/`--help` state the non-transitivity with an example.)
- **test**: evaluate `content` in the dependency scope; the result **must be a boolean**:
  - `true` ⇒ `status: 'pass'`.
  - `false` ⇒ `status: 'fail'` with a **safe** message `Assertion failed in cell '<id>'` — the cell *content* is deliberately NOT embedded (avoids leaking large/sensitive expressions into logs).
  - non-boolean ⇒ `status: 'error'`, message `test cell must evaluate to a boolean, got <typeof>`.
  - This avoids the throw-on-falsy anti-pattern (which conflated a legitimate test *failure* with a runtime *error* and was ambiguous for MathTS truthiness of `0`/`NaN`/empty matrix). `runReport` performs the pass/fail/error classification; `executeCell('test')` returns the boolean or throws only on a genuine evaluation error.
- **data**: `parseYaml(content)` with the hardened options from §5 (unchanged otherwise). **markdown**: passthrough (unchanged).
- **tensor / equation / visualization / export**: keep throwing `Unsupported cell type: X` (deferred to later phases).

## 7. Components (files in `workbook/src/`)

### 7.1 `parser.ts` — implement `parseWorkbook`
```ts
export function parseWorkbook(content: string): ParseResult;
```
- Guard: non-string / empty / whitespace ⇒ structured error (preserve existing messages + the defensive `catch` that the robustness tests exercise).
- Parse with `yaml`'s `parse` using the **hardened options** from §5 (`{ schema: 'core', merge: false }`) and apply the **prototype-pollution guard** (reject `__proto__`/`constructor`/`prototype` own keys). Map the document to `Workbook`: apply defaults for `version`/`metadata`/`runtime`; map each raw cell to `{ id, type, content, dependsOn, metadata }` after enforcing the **exactly-one-type-key** rule (§5).
- Run the §5 validation rules; collect errors. Graph helpers are not invoked unless `success === true`.
- `serializeWorkbook` stays deferred (continues to throw "not yet implemented" — its test is unchanged). `stripOutputs` / `detectCellType` unchanged.

### 7.2 `executor.ts` — add `test` case + `runReport`
- Add a `case 'test'` to `executeCell` implementing §6 test semantics.
- Add:
```ts
interface CellResult {
  id: string;
  type: CellType;
  status: 'success' | 'error' | 'pass' | 'fail';
  output?: unknown;
  error?: string;
}
interface RunResult { cells: CellResult[]; ok: boolean; }

class WorkbookExecutor {
  // ...existing...
  async runReport(): Promise<RunResult>;
}
```
- `runReport`: first call `detectCycles`; if any cycle, return `{ cells: [], ok: false }` plus a synthesized `CellResult` (status `'error'`) naming the cycle. Otherwise iterate `graph.executionOrder`, run each cell in a try/catch (so one failure does not abort the rest), classify:
  - `test` cell → `pass` (boolean `true`), `fail` (boolean `false`, safe message), or `error` (non-boolean / threw) per §6.
  - other cells → `success` (resolved) or `error` (threw).
  - aggregate `ok = cells.every(c => c.status === 'success' || c.status === 'pass')`.
- **`runReport` vs `runAll` (two intentional APIs):** `runReport` is the **headless/report** API — continue-on-error, returns structured `RunResult`, never throws on cell failure. `runAll` remains the **event-stream/reactive** API — it throws on the first cell error and is consumed via `on(...)` events. They coexist by design; the CLI uses `runReport`. This distinction is documented in code comments and the README.
- `runCell` / `runAll` are otherwise **unchanged** (existing tests rely on `runCell` rejecting on error).

### 7.3 `formatter.ts` *(new)*
```ts
export function formatResult(value: unknown): string;
```
- Readable rendering for terminal output: `string`/`number`/`boolean` directly; `bigint` via `String(value)` + `n` suffix; `Complex`/`Fraction`/matrix types via their `toString()` when meaningful; objects/arrays via `JSON.stringify`. `undefined`/`null` ⇒ `"(no result)"`.
- **Must never throw** (it runs inside `runReport`'s continue-on-error loop). `JSON.stringify` is wrapped: a **`WeakSet` cycle guard** replacer handles circular references (`"[Circular]"`), a `bigint` replacer avoids the native `TypeError`, and any residual throw falls back to `String(value)` then to `"[unserializable]"`. Small, pure, fully unit-tested — including circular-ref, BigInt, and `undefined` cases.

### 7.4 `graph.ts` — add `toMermaid`
```ts
export function toMermaid(graph: DependencyGraph): string;
```
- Emit a Mermaid `graph TD` with one edge per dependency (`dep --> cell`). Nodes are declared as `id["id"]` — the node id and quoted label are both the **validated cell id** (`[A-Za-z_][A-Za-z0-9_]*`), so Mermaid syntax injection is impossible by construction; **no cell content** appears in the graph. Reuses the existing graph structures.

### 7.5 `cli.ts` — implement run / validate / graph
- Refactor command handlers to be **testable**: each returns `{ stdout: string; stderr: string; exitCode: number }` (no direct `process.exit` / `console.log` inside the handler). A thin `main()` wires `stdout` → `process.stdout`, `stderr` → `process.stderr`, and calls `process.exit(exitCode)`.
- **Stream conventions:** normal results (including the `--json` payload) go to **stdout**; diagnostics, parse errors, cell errors, and usage go to **stderr**. The exit code is independent of which stream is used — `--json` still exits non-zero when `ok === false`, so scripts can branch on exit code while consuming clean JSON on stdout.
- `run <file> [-v] [--json]`: `readFileSync` → `parseWorkbook` → on parse error, write errors to stderr + exit 1 → else `createExecutor(...).runReport()` → write per-cell results via `formatResult` to stdout (or a single JSON document with `--json`); cell errors/test failures also summarized to stderr; `-v` also prints the event stream. Exit code = `result.ok ? 0 : 1`.
- `validate <file>`: parse + structural checks + `detectCycles` + dep-id existence + id validity. Print `OK` or a problem list. Exit code reflects.
- `graph <file> [-f mermaid]`: text adjacency by default; Mermaid via `toMermaid` with `-f mermaid`.
- Trim `HELP` to the implemented commands (`run`, `validate`, `graph`, `-h`, `-V`). Remove/var: `new`/`watch`/`strip`/`export` are out of scope; do not advertise them.
- File reads use `node:fs`.

### 7.6 `types.ts` — add result types
- Add `CellResult` and `RunResult` (as in §7.2).

### 7.7 `index.ts` — exports
- Export `runReport`'s result types, `formatResult`, and `toMermaid`.

## 8. Error handling

| Failure | Handling |
|---|---|
| Empty/whitespace/non-string input | `ParseResult.errors`; CLI writes to stderr + exit 1 |
| Malformed YAML / disallowed tags | caught; `ParseResult.errors` with the YAML message (hardened `{schema:'core', merge:false}`) |
| `__proto__`/`constructor`/`prototype` key | rejected by the prototype-pollution guard; `ParseResult.errors` |
| Missing/duplicate/invalid id, 0-or->1 type key, dangling `depends_on` | **hard** `ParseResult.errors` (`success:false`) — gates graph construction; CLI exit 1 |
| Cycle | detected before run (`detectCycles`); `run`/`validate` refuse with a clear message; exit 1 |
| Cell execution error | caught per-cell in `runReport`; recorded as `status:'error'`; **execution continues**; stderr summary; overall exit 1 |
| Test assertion `false` | `status:'fail'`, safe message (no content); overall exit 1 |
| Test result non-boolean | `status:'error'` (`must evaluate to a boolean`); overall exit 1 |

## 9. Testing plan (vitest, TDD — RED→GREEN per unit)

- **Rewrite** `parser.test.ts`: replace the stub-asserting cases with real parsing of a sample `.mtsw` string → assert cells (ids, types, content, dependsOn) and the §5 validation errors (missing id, dup id, invalid id, dangling dep). Keep empty/whitespace/null error-path cases (incl. the robustness `catch` cases). `detectCellType` tests unchanged. `serializeWorkbook` "throws" test unchanged.
- **New** parser security tests: disallowed YAML tags rejected; `__proto__`/`constructor`/`prototype` key rejected; cell with 0 type keys and cell with >1 type key both error.
- **New** executor tests: `test` cell pass, fail (boolean `false` → safe message, content NOT in message), and non-boolean → error; `runReport` continue-on-error (one failing cell, others still reported); `runReport` cycle refusal; object-literal multi-value export + downstream property access; **non-transitive scope** (a→b→c: `a` cannot see `c`).
- **New** `formatter.test.ts`: each value-kind branch **plus circular-ref, BigInt, and `undefined`** (must not throw).
- **New** `graph` test: `toMermaid` output for a small graph (asserts `id["id"]` node form, no content).
- **New** `cli.test.ts`: call the refactored handlers against a fixture `.mtsw` string/file; assert `stdout` / `stderr` / `exitCode` for `run` (success, parse error, test failure, `--json` non-zero exit), `validate`, `graph -f mermaid`. Include a fixture exercising **markdown and data cells** end-to-end and assert their outputs.
- **Replace** `examples/basic-workbook.mtsw` with an expression-style workbook that actually runs and **self-verifies via `test` cells**; add an end-to-end test that runs it through `runReport` and asserts `ok === true` (this doubles as the demo).

## 10. Out of scope (later phases)

Electron/React GUI · `serializeWorkbook` · `new`/`watch`/`strip`/`export` commands · `tensor`/`equation`/`visualization`/`export` cells · TypeScript code execution · any rendering / LaTeX / PDF / HTML / ipynb export.

## 11. Global constraints (from CLAUDE.md / AGENTS.md)

- ESM-only (`"type": "module"`); **import extensions must be `.js`**.
- Files `kebab-case.ts`; classes `PascalCase`; functions/vars `camelCase`.
- vitest with **explicit** `import { describe, it, expect } from 'vitest'`.
- **Security invariant preserved**: code/test execution goes only through `evaluate` (the sandboxed engine); no `Function`/`vm`/`eval`; no direct `obj[name]` access added in `expression/`.
- Build via tsup, **two entry points** (`src/index.ts` + `src/cli.ts`), ESM, `--dts`.
- Type gate: `tsc --noEmit` (0 errors on the package).
- Conventional Commits (`feat(workbook):`, `fix(workbook):`, `test(workbook):`).
- **Do not run `npm publish`** (requires 2FA; manual). Versioning via Changesets.

## 12. Acceptance criteria

1. `npx mtsw run examples/basic-workbook.mtsw` parses, executes in dependency order, prints readable per-cell results, and exits 0 (all `test` cells pass).
2. A `.mtsw` with a failing `test` cell exits non-zero and clearly reports which test failed.
3. `mtsw validate` flags a missing id, a duplicate id, an invalid id, a dangling `depends_on`, and a cycle.
4. `mtsw graph -f mermaid` emits a valid `graph TD` diagram (nodes as `id["id"]`).
5. `npm run typecheck` and `npm run test` (workbook package) are green; the security invariant is untouched.
6. `formatResult` never throws — verified against circular-ref, BigInt, and `undefined` inputs.

## 13. Peer review record (Adam = gemini-2.5-pro, Eve = o3)

**Adopted** into this spec: crash-proof `formatResult` (cycle/BigInt guard) · boolean-only `test` cells with safe failure messages · hardened YAML parsing (`schema:'core'`, `merge:false`) + prototype-pollution guard · dangling/dup/invalid-id and 0/>1-type-key as hard errors gating graph construction · CLI `{stdout, stderr, exitCode}` with errors→stderr and `--json` exiting non-zero · explicit non-transitive dependency scope · injection-safe Mermaid (`id["id"]`, no content) · `runReport` vs `runAll` two-API note · markdown/data acceptance coverage; help keeps examples.

**Declined (with rationale):**
- *Adam — change cell format to explicit `{type, content}` keys (BLOCKER).* Declined: would break the existing `.mtsw` format, the example, and `detectCellType`'s tests. The ambiguity he targeted is closed instead by the **exactly-one-known-type-key** rule (error on 0 or >1).
- *Eve/Adam — static symbol scan to detect implicit variable references.* Declined for v1: parsing MathTS expressions for free variables is disproportionate effort; missing references surface as ordinary, reported cell errors. Logged as a possible later enhancement.

Verdicts at review time: Adam **NEEDS-REWORK** (chiefly the format change, declined above), Eve **APPROVE-WITH-CHANGES** (all changes incorporated).
