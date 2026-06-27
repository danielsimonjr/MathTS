# Workbook GUI Machine Read-Contract — Design Spec (slice 3)

**Status:** Draft (awaiting peer review + sign-off)
**Package:** `@danielsimonjr/mathts-workbook`
**Builds on:** headless v1 ([[2026-06-27-workbook-headless-v1-design]]) + round-trip/CLI ([[2026-06-27-workbook-roundtrip-cli-design]]).

---

## 1. Goal & context

The GUI will sit on top of the CLI layer; **every GUI operation is a CLI operation**. Agreed coupling: a **stable `--json` machine contract now** (GUI spawns per-action to start), a persistent **`mtsw serve`** later (slice 5). This slice delivers the **read / introspect / targeted-run** surface the GUI needs to *open and display* a workbook, plus the schema discipline everything else depends on. Cell mutation is slice 4; `serve` + streaming + full incremental engine is slice 5.

## 2. The machine contract (schema discipline) — revised per peer review

**Unified envelope.** EVERY `--json` output is one JSON document on **stdout** with the same shape, so the GUI binds one parser:
```json
{
  "schemaVersion": { "major": 1, "minor": 0 },
  "command": "describe",
  "ok": true,
  "data": { /* command-specific payload */ },
  "problems": []
}
```
- **`schemaVersion`** is semver-ish `{major, minor}`. Compatibility rule (documented for clients): a reader **ignores unknown fields** when `major` matches, and **refuses** on a `major` mismatch. Additive fields bump `minor`; breaking changes bump `major`.
- **`ok`** is the single success/failure signal. **`problems`** is always present (array; structured error/warning strings), populated whether `ok` is true or false. **`data`** holds the command payload (or `null` on failure).
- **Envelope-always-emitted contract:** whenever the command *ran*, a valid envelope is written to stdout — even on logical failure (`ok:false`, partial `data`). The **exit code mirrors `ok`** (`0`/`1`) for shell use, but **GUI clients read `envelope.ok` and ignore the exit code**; a *missing or unparseable* envelope is the only "transport error" signal (crash/SIGINT).
- Diagnostics/human text go to **stderr**; machine JSON owns **stdout**. Sandboxed cells have **no I/O**, so cell execution can never pollute the stdout envelope.
- Security: every command reads only the supplied `<file>` (no transclusion/includes). `capabilities`/`templates` read no file.

## 3. Commands (this slice)

All `--json` payloads are wrapped in the §2 envelope; the shapes below are the **`data`** field.

### 3.1 `describe <file> [--json]` (NEW) — the GUI "open document" call
`data`:
```json
{
  "version": "1.0",
  "metadata": { "title": "..." },
  "runtime": { "engine": "mathts", "execution": "reactive" },
  "cells": [
    { "id": "a", "type": "code", "content": "1 + 1",
      "dependsOn": [], "metadata": {}, "output": 2, "error": null }
  ],
  "graph": { "edges": [ { "from": "a", "to": "b" } ], "cycles": [] }
}
```
- `content` IS included (GUI renders it). `output`/`error` ARE included (from the parsed file — best-effort raw value, `null` when absent) so the GUI shows last-saved state on open without re-running. (`hasOutput` removed.)
- `problems` (envelope field) merges parse errors + cycles — the same set `validate` reports.
- `graph.edges`: `from` = dependency, `to` = dependent (documented direction).
- On parse failure: envelope `ok:false`, `problems:[...]`, `data:{cells:[]}` (partial), exit 1. Human form prints a summary (title, N cells by type, problem count) / errors to stderr.

### 3.2 `validate <file> [--json]` (NEW flag)
`data`: `{ "cellCount": 3 }` — with envelope `ok`/`problems` carrying the verdict. exit `ok ? 0 : 1`. Human form unchanged.

### 3.3 `run <file> [--cell <id>] [--json] [-v] [--write]` — targeted run + envelope migration
- **`run --json` migrates to the envelope** (`data: { cells: [ {id,type,status,output,error} ] }`, `ok` from the report). (Free: no external consumers yet.)
- **`--cell <id>`** (alias `-c`): run cell `<id>` **and its transitive dependencies** in dependency order; report exactly those cells. **Stateless/cold** — dependencies are recomputed every call (no session/cache in this slice; the incremental/`--no-deps` path arrives with `serve` in slice 5). This is documented as a known perf characteristic. Unknown `<id>` → `ok:false`/stderr, exit 1. Cycle involving target → refused. Implemented via `getAncestors(graph, id)` (transitive `dependsOn` + self). **One id per invocation** in this slice.

### 3.4 `graph <file> [-f mermaid]` (unchanged; NO `--json`)
`graph --json` is intentionally **not** added — `describe.graph` is the canonical structured source (avoids a divergent second representation). `graph` keeps its human text + `-f mermaid` forms.

### 3.5 `capabilities [--json]` (NEW) — engine/feature negotiation
`data`:
```json
{
  "name": "mtsw",
  "version": "0.1.0",
  "cellTypes": { "supported": ["code","markdown","data","test"],
                 "deferred": ["tensor","equation","visualization","export"] },
  "commands": ["run","validate","graph","strip","new","describe","capabilities","templates"],
  "features": { "json": true, "write": true, "runCell": true, "incremental": false, "serve": false }
}
```
Human form: a readable list. Reads no file.

### 3.6 `templates [--json]` (NEW) — new-document palette
`data`: `{ "templates": [ { "name": "basic", "description": "..." } ] }`, from the same `TEMPLATES` registry `new` uses (single source of truth). Reads no file.

## 4. Components

- **`graph.ts`**: add `getAncestors(graph, id): string[]` — transitive `dependencies` of `id` **plus** `id`, in topo order (cycle-safe via a visited set). Pure.
- **`executor.ts`**: `runReport(options?: { only?: string })` — when `only` is set, restrict execution to `getAncestors(graph, only)` (filter `executionOrder`); cycle refusal + classification unchanged. Back-compat: no-arg call runs everything (existing behavior/tests untouched).
- **`cli.ts`**: `SCHEMA_VERSION = { major: 1, minor: 0 }`; a `jsonEnvelope(command, ok, data, problems)` helper that builds the §2 envelope (and the existing `run --json` is migrated to use it). Add `describeCommand`, `capabilitiesCommand`, `templatesCommand`; add a `--json` branch to `validateCommand` (NOT `graphCommand`); add `--cell`/`-c <id>` to `runCommand` (value-flag → add `-c`/`--cell` to `VALUE_FLAGS`); HELP + dispatch updated. `TEMPLATES` becomes `{ name → { content, description } }` so `new` and `templates` share one registry.
- **`index.ts`**: export `getAncestors`, `SCHEMA_VERSION`.

## 5. Error handling
Parse/usage errors → stderr (human) or structured `problems`/`{ok:false}` (`--json`), exit 1. `run --cell` unknown id → stderr, exit 1. `capabilities`/`templates` never read a file → always succeed.

## 6. Testing (vitest, TDD)
- `getAncestors`: linear chain, diamond, self-only, cycle-safe.
- `runReport({only})`: runs only the target + its deps, NOT unrelated cells; `only` for an unknown id behaves sanely (empty/clear).
- CLI `--json`: `validate`/`describe`/`capabilities`/`templates`/`run`/`run --cell` each emit the **envelope** (`schemaVersion {major,minor}`, `command`, `ok`, `data`, `problems`); `JSON.parse` round-trips; exit code mirrors `ok`; the envelope is emitted even when `ok:false`.
- `describe`: cells include id/type/content/dependsOn/**output/error**; `problems` includes a cycle; `graph.edges` direction (from=dep, to=dependent) correct.
- `run --cell <id>`: only the subgraph runs (assert an unrelated cell is absent from results); unknown id → `ok:false`, exit 1.
- `graph` has **no** `--json` (assert it still does text/mermaid).
- `templates` ↔ `new` share the registry (a template listed by `templates` is accepted by `new`).

## 7. Out of scope (later slices)
Cell mutation (`cell add/edit/rm/move`) = slice 4. `mtsw serve` (JSON-RPC + streaming events) + true incremental/reactive re-exec (stale-set across a session) + `functions --json` autocomplete = slice 5. No GUI code.

## 8. Global constraints
ESM-only; vitest explicit imports; security invariant untouched; tsup two entry points; `tsc --noEmit` gate; Conventional Commits; **no `npm publish`**; a Changesets `minor` entry.

## 9. Acceptance criteria
1. Every `--json` command emits the unified envelope (`schemaVersion {major,minor}`, `command`, `ok`, `data`, `problems`); `JSON.parse` succeeds; the envelope is emitted even on `ok:false`; exit code mirrors `ok`.
2. `mtsw describe f.mtsw --json` returns cells with content + dependsOn + output/error, `problems`, and `graph.edges`.
3. `validate --json` carries the verdict in `ok`/`problems`; human form unchanged. `graph` has no `--json` (text/mermaid only).
4. `mtsw run f.mtsw --cell <id>` runs only `<id>` + its transitive deps (an unrelated cell does not appear in results); unknown id → `ok:false`, exit 1.
5. `capabilities --json` and `templates --json` emit their shapes; `templates` and `new` agree on the template set.
6. Full workbook suite + `tsc --noEmit` green; security invariant untouched.

## 10. Peer review record (Adam gemini-2.5-pro / Eve o3)
**Adopted:** unified envelope `{schemaVersion,command,ok,data,problems}` for all `--json` (incl. migrating `run --json`); semver `{major,minor}` schema + ignore-unknown/refuse-major rule; `describe` includes cached `output`/`error` (drop `hasOutput`); drop `graph --json` (describe.graph canonical); exit mirrors `ok` **and** envelope always emitted (GUI reads `ok`); document `run --cell` as stateless/cold and security as single-file-read.
**Declined (rationale):** NDJSON streaming for `run` (→ slice 5 `serve`; envelope is forward-compatible); stdout-pollution from cell output (N/A — sandboxed cells have no I/O); `--no-deps`/incremental for `run --cell` (→ slice 5 with the session); enforced key sorting (insertion order is deterministic).
Verdicts at review: Adam APPROVE-WITH-CHANGES, Eve NEEDS-REWORK — all adopted items incorporated.
