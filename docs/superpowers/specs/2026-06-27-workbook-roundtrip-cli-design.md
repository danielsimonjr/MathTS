# Workbook Round-trip + CLI Completeness — Design Spec

**Status:** Draft (awaiting peer review + user sign-off)
**Package:** `@danielsimonjr/mathts-workbook`
**Builds on:** the headless v1 ([[2026-06-27-workbook-headless-v1-design]]). Same scope rules (headless, MathTS-expression cells, security invariant). This slice completes the load↔save story and rounds out the CLI.

---

## 1. Goal

Complete the symmetric other half of the parser — **`serializeWorkbook`** (load↔save) — and round out the CLI with `strip`, `new`, and an opt-in `run --write`. This is the create / run / persist / git-clean foundation the future GUI builds on.

## 2. Current gap

- `serializeWorkbook(workbook)` still **throws** `serializeWorkbook not yet implemented` (its test asserts the throw — that test will be replaced).
- The parser sweeps unknown cell keys into `metadata`, so `output`/`error` written back would not round-trip into `cell.output`/`cell.error`.
- CLI has only `run`/`validate`/`graph`; `strip`/`new` are gone from v1's trimmed HELP and unimplemented; there is no way to persist run results.

## 3. Decisions (locked)

1. **Output values: raw, best-effort.** `serializeWorkbook` writes `cell.output` as its native YAML value. Plain numbers/strings/booleans/arrays/objects round-trip exactly; exotic types (e.g. `Complex`) serialize to their plain enumerable shape (best-effort, documented). **Structural round-trip (version/metadata/runtime/cells: id/type/content/dependsOn/metadata) is always exact.**
2. **`mtsw strip` defaults to stdout**, `-w`/`--write` overwrites in place.
3. `mtsw new` ships one template (`basic`); `-t` accepts it, unknown → error listing available templates.
4. `mtsw run` stays read-only unless `--write` is passed.

## 3.5 Peer-review hardening (incorporated — Adam gemini-2.5-pro / Eve o3)

- **Atomic file writes.** `strip -w`, `run --write`, and `new` must NOT truncate in place. Write to a sibling temp file (`<path>.<pid>.tmp`) then `fs.renameSync` over the target (atomic on the same filesystem; avoids crash-corruption and TOCTOU). A shared `writeFileAtomic(path, content)` helper.
- **`new` name safety.** Reject a `<name>` containing path separators (`/`, `\`) or that is absolute (path-traversal guard) → error. Create with the exclusive flag (`{ flag: 'wx' }`) so an existing file (incl. a symlink) is never clobbered without `--force`; with `--force`, `lstat` and refuse if the target is a symlink, else overwrite atomically.
- **serialize metadata-collision filter.** When spreading a cell's `metadata`, drop any key equal to a recognized type key or a reserved key (`id`/`depends_on`/`output`/`error`/`language`/`format`). Structural keys are written from the cell fields, never from metadata — so a hand-built workbook can never serialize into a cell with two type keys or a clobbered id.
- **String-output type fidelity (verify, don't assume).** Raw output persistence relies on `yaml.stringify` quoting scalars that would otherwise re-type (`"true"`, `"123"`, `"null"`, `"[1,2]"`). This is asserted by explicit round-trip tests; if `yaml` does not quote, escalate to tagged-string output. (No `{type,value}` wrapper unless tests force it.)
- **Prototype-pollution coverage of persisted output/error.** `parseWorkbook` already runs `findPollutionKeys` over the entire parsed document, which now includes `cells[].output/error`; covered. Locked by a test (a persisted `output` carrying `__proto__`/`constructor` → parse error).
- **`run --write` stdout hygiene.** On `--write`, stdout stays clean; a one-line "updated &lt;file&gt;" confirmation and any failure summary go to stderr. Exit code = `ok ? 0 : 1`.
- **Comment/ordering loss (documented limitation).** Any write path is parse→serialize and therefore drops original YAML comments and key ordering. Documented in the README; a CST-preserving in-place patch (yaml Document API) is a future enhancement, out of scope here.

## 4. Components

### 4.1 `parser.ts` — read `output`/`error` back
- Add `output` and `error` to `RESERVED_CELL_KEYS` so they are NOT swept into `metadata`.
- In `mapCell`, when present, set `cell.output = raw.output` and `cell.error = String(raw.error)`.
- Round-trip invariant: a cell serialized with output/error parses back with the same `output`/`error` (best-effort value fidelity per §3.1).

### 4.2 `parser.ts` — implement `serializeWorkbook(workbook): string`
- Build a plain object: `{ version, metadata, runtime, cells: [...] }`.
  - Omit empty `metadata` and default `runtime`? **No** — emit them for a stable, explicit document (round-trip is what matters, not minimality). Always emit `version`, `metadata` (even if `{}`), `runtime`.
  - Each cell → `{ [cell.type]: cell.content, id, ...(dependsOn ? {depends_on} : {}), ...metadata, ...(output !== undefined ? {output} : {}), ...(error ? {error} : {}) }`. The single type key carries the content (so `detectCellType`/the exactly-one-type-key rule re-detects it on parse).
- Serialize with `yaml.stringify(doc, { lineWidth: 0 })` (no line wrapping, to avoid folded-scalar whitespace drift). If multi-line content does not round-trip with defaults, force literal block style via stringify options — the round-trip test is the gate.
- **Throws** only on a structurally invalid workbook (e.g. missing `cells` array) — otherwise total.

### 4.3 `cli.ts` — `strip`
- `strip <file> [-w|--write]`: read → `parseWorkbook` → on error, stderr + exit 1 → `stripOutputs` → `serializeWorkbook` → **stdout** (default) or **overwrite the file** with `-w`. On `-w`, stdout is a short confirmation; the YAML goes to the file.

### 4.4 `cli.ts` — `new`
- `new <name> [-t basic] [--force]`: resolve target `<name>.mtsw` (append `.mtsw` if absent). If it exists and no `--force` → stderr + exit 1. Else write the `basic` template (a markdown intro + a `code` cell + a `test` cell that passes) and print the path. Unknown `-t` → stderr listing available templates (`basic`).

### 4.5 `cli.ts` — `run --write`
- When `--write` is present, after `runReport`, write each result back onto the workbook cell (`cell.output`/`cell.error` from the `CellResult`), then `serializeWorkbook` and overwrite the file. Print the normal run summary; note the file was updated on stderr. Exit code unchanged (`ok ? 0 : 1`). Never writes without `--write`.

### 4.6 `index.ts`
- `serializeWorkbook` is already exported. Export any new helper used by templates if extracted (e.g. `BASIC_TEMPLATE`); otherwise no change.

## 5. HELP / surface
Restore `strip`/`new` to HELP (with `run`/`validate`/`graph`). Document `run --write`, `strip -w`, `new -t/--force`. Do not advertise `watch`/`export` (still out of scope).

## 6. Error handling
| Failure | Handling |
|---|---|
| Parse error in strip/run/new-target | structured errors → stderr, exit 1 |
| `serializeWorkbook` on invalid workbook (no cells array) | throws; CLI catches → stderr, exit 1 |
| `new` target exists without `--force` | stderr, exit 1 |
| `new` unknown template | stderr (lists templates), exit 1 |
| File write failure (`-w`/`--write`/`new`) | caught → stderr, exit 1 |

## 7. Testing (vitest, TDD)
- **Rewrite** the `serializeWorkbook` "throws" test → real serialization.
- **Round-trip** tests: `parseWorkbook(serializeWorkbook(wb))` reproduces structure (ids, types, content incl. multi-line **with leading/trailing whitespace and blank lines**, dependsOn, metadata) for a representative workbook; a primitive `output` (number/string) round-trips; `error` round-trips.
- **String-output type fidelity**: outputs `"true"`, `"123"`, `"null"`, `"[1,2]"` round-trip as the same STRING (not re-typed) — the gate for the raw-output decision.
- **serialize robustness**: a hand-built cell whose `metadata` contains a key named `code`/`id`/`output` does not produce an invalid (multi-type-key / clobbered-id) document — colliding keys are dropped.
- **proto-pollution**: a workbook serialized with an `output` object carrying `__proto__`/`constructor` fails to re-parse (guard covers persisted output).
- **Parser** tests: `output`/`error` are read onto the cell and NOT placed in `metadata`.
- **Atomic write / safety**: `new` refuses a name with path separators or an existing target without `--force`; `strip -w`/`run --write` replace content via the temp+rename path (assert final file content; original unchanged when the command is read-only).
- **CLI** tests (handlers, temp files): `strip` to stdout strips outputs; `strip -w` rewrites the file; `new` creates a runnable workbook (parse + run it → ok) and refuses to overwrite without `--force`; `run --write` persists outputs (re-read file shows output/error); `run` without `--write` leaves the file unchanged.
- Update `package-index` smoke test if exports change.

## 8. Out of scope (unchanged)
GUI; `watch`/`export` commands; non-`basic` templates; `tensor`/`equation`/`visualization`/`export` cells; TypeScript execution; rendering/LaTeX/PDF/ipynb.

## 9. Global constraints
ESM-only; `.js`-or-extensionless per existing package convention; vitest explicit imports; security invariant untouched (no `Function`/`vm`/`eval`); tsup two entry points; `tsc --noEmit` gate; Conventional Commits; **no `npm publish`** (2FA). A Changesets entry (`minor`) accompanies the change.

## 10. Acceptance criteria
1. `serializeWorkbook` produces YAML that `parseWorkbook` reads back with identical structure (round-trip test green).
2. `mtsw new demo && mtsw run demo.mtsw` → scaffolds and runs clean (exit 0).
3. `mtsw run demo.mtsw --write` persists outputs; re-reading shows them; a subsequent `mtsw strip demo.mtsw` removes them.
4. `mtsw strip` defaults to stdout; `-w` rewrites in place.
5. Full workbook suite + `tsc --noEmit` green; security invariant untouched.
