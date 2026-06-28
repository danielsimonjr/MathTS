# Workbook `serve` + Incremental Engine + `functions`/`meta` — Design Spec (slice 5)

**Status:** Draft (awaiting peer review + sign-off)
**Package:** `@danielsimonjr/mathts-workbook`
**Builds on:** read-contract ([[2026-06-27-workbook-gui-read-contract-design]]), cell mutation ([[2026-06-27-workbook-cell-mutation-design]]).

---

## 1. Goal

The persistent channel the GUI attaches to: **`mtsw serve`** — a single-document, JSON-RPC-over-stdio session with **streaming run events** and **incremental re-execution** (re-run only what an edit invalidated). Plus two one-shot command expansions: **`functions`** (autocomplete data) and **`meta get|set`** (workbook-level metadata editing). This is the last CLI slice before the Electron GUI builds on top.

Decisions (locked): **single document per `serve` process**; expansions = `functions` + `meta` (no `fmt`, no `--expect-hash` — concurrency stays last-write-wins / deferred).

## 2. Architecture (testability first)

Three layers, each independently testable:
1. **`Session`** (`session.ts`) — pure-ish in-memory state: the workbook, the source path, a per-cell result **cache**, and a **stale set**. Methods `open`/`describe`/`run`/`applyEdit`/`setMeta`/`save` mutate state and return data. No I/O except `save`/`open` file access.
2. **`handleRequest(session, request)`** (`rpc.ts`) — a **pure** JSON-RPC 2.0 router: maps a request to a Session call, returns `{ response, events }` (events = `cell/event` notifications produced during a run). No stdio — fully unit-testable.
3. **`runServer(stdin, stdout)`** (`cli.ts`/`serve.ts`) — the thin NDJSON loop: read a line → `JSON.parse` → `handleRequest` → write response + events as JSON lines. The only stdio.

## 3. Incremental execution

The latency win: a `run` re-executes only **stale** cells, reusing cached outputs for the rest.

- **Executor additions** (`executor.ts`): `seedOutputs(map)` (populate the outputs cache) and `runReport({ only?, runIds? })` — when `runIds` is given, execute only cells whose id ∈ `runIds` (still in topological order, still cycle-checked); cells not in `runIds` keep their seeded cached output (used as scope for downstream cells) and are not re-run.
- **Session cache + stale tracking (diff-based — see §3.5):**
  - `open`: cache empty; `stale` = all cell ids; `dirty = false`.
  - `applyEdit` (any `cell.*`/`meta.*`): run the pure op (atomic — a throw leaves session state unchanged and returns a JSON-RPC error). On success, recompute `stale` by **diffing** the old and new workbooks (§3.5), prune the cache to surviving ids and drop the newly-stale ones, set `dirty = true`.
  - `run({ only? })`: target = `only ? getAncestors(only) : allIds`; **toRun** = target ∩ stale (topo order). Seed a fresh executor with the **raw output values** of cached *successful* cells (error/fail cells are not seeded), execute `runIds = toRun`, merge new `CellResult`s into the cache, clear `stale` for run cells. Result = the merged `RunResult` over the target set (cached + freshly run); emit a `cell/event` per executed cell. (Because edits propagate staleness to dependents, a stale ancestor of a fresh cell cannot occur after the first run.)

## 3.5 Peer-review hardening (incorporated — Adam gemini-2.5-pro / Eve o3)

- **Diff-based invalidation (replaces per-op "affected").** After an edit, a new-workbook cell is **stale** iff its canonical form changed or it is new, OR it transitively depends (new graph) on such a cell. Canonical form = `JSON.stringify([type, content, dependsOn ?? [], metadata ?? {}])` (excludes id — that's the key — and output/error). Removed ids drop from the cache; their former dependents have an edited `depends_on` (or rewritten content) so they diff → stale. `move` (reorder only) changes no canonical form → nothing stale. This one rule is correct across add/edit/rm/move/rename without special-casing.
- **`seedOutputs(Map<id, rawValue>)`** — the executor caches raw output values; the Session extracts `.output` from cached *successful* CellResults before seeding (never seeds an error/fail cell).
- **`open` data-loss guard** — refuse (`-32001 "unsaved changes"`) if the session is `dirty`, unless `open {force:true}`. `save` clears `dirty`.
- **`applyEdit` atomic** — pure ops already throw on invalid/cycle (slice 4), so a failed edit never mutates session state; the method returns a JSON-RPC error.
- **NDJSON framing** — `runServer` uses Node `readline` over stdin (handles chunked input, `\r\n`); each line → one request. **Batch arrays are rejected** (`-32600`). The loop wraps `handleRequest` in try/catch → `-32603` so a handler bug never crashes the server. **Trusted-client assumption:** no max-line cap / stdout-backpressure handling in v1 (the client is the GUI, not adversarial) — noted.
- **Lifecycle** — `shutdown` request, stdin EOF, and `SIGINT`/`SIGTERM` all clean-exit 0.
- **`save` path** — uses `params.path ?? session.path`; errors if neither exists. `open`/`save` accept full paths (the client is the user — no bare-name restriction, unlike `new`).

## 4. `serve` JSON-RPC protocol (single document)

- Transport: **JSON-RPC 2.0**, newline-delimited JSON on stdio (one object per line). Requests have `id`; responses echo `id`; events are id-less notifications.
- **Methods** (params/results are the same data shapes as the matching one-shot `--json` commands' `data`):
  | Method | Effect |
  |---|---|
  | `open` `{path}` | load file into the session → `describe` doc (+ `path`) |
  | `describe` | current doc model |
  | `validate` / `graph` | as one-shots, over the session doc |
  | `run` `{only?}` | incremental run; streams `cell/event`; returns `RunResult` |
  | `cell/add\|edit\|rm\|move\|rename` `{...}` | mutate **in memory** (mark stale); return updated doc |
  | `meta/get` / `meta/set` `{...}` | read/update workbook metadata (in memory) |
  | `save` `{path?}` | serialize + atomic write to `path` (or the opened path) |
  | `capabilities` / `functions` | engine introspection |
  | `shutdown` | stop the loop (clean exit) |
- **Events:** during `run`, `{ "jsonrpc":"2.0", "method":"cell/event", "params": { type, cellId, ... } }` for `cell:start`/`cell:success`/`cell:error`/`cell:stale`.
- **Errors:** JSON-RPC error object `{ code, message }` (parse error -32700, invalid request -32600, method not found -32601, invalid params -32602, internal -32603). A malformed line never crashes the loop — it yields a parse-error response and the loop continues.
- **Edits are in-memory until `save`** (the GUI controls persistence). `serve` holds no file lock; last-write-wins remains (the `--expect-hash` guard is future work).

## 5. One-shot command expansions

- **`functions [--json]`** — enumerate what code cells can call. Source: the exported callables/values of `@danielsimonjr/mathts-functions` (introspected via `Object.entries`, partitioned into `functions` (typeof `'function'`) and `constants` (other values like `pi`, `e`)). `data`: `{ functions: string[], constants: string[] }` — **names only** (no signature/typed-function serialization, which would be huge); the introspection result is computed once per process. Documented as "exported surface" (best-effort; not a guarantee of the expression engine's full internal symbol table). Reads no file.
- **`meta get <file> [--json]`** — `data` = the workbook `metadata` object. Human: `key: value` lines.
- **`meta set <file> [--title s] [--author s] [--description s] [--tags a,b] [--json]`** — update the provided metadata fields via a pure `setMetadata(wb, changes)` (`edit.ts`); atomic write; `--json` returns updated metadata. Unset a field with an empty value? No — only provided flags are changed (tags replaced as a list; empty `--tags ""` clears tags).

## 6. Components
- **`executor.ts`**: `seedOutputs`, `runReport({ runIds })`.
- **`session.ts`** (new): `Session` class (state + open/describe/run/applyEdit/setMeta/save), reusing `edit.ts` ops + the incremental executor.
- **`rpc.ts`** (new): `handleRequest(session, request)` pure router + JSON-RPC types/error codes.
- **`edit.ts`**: add `setMetadata(wb, changes)`.
- **`cli.ts`**: `serveCommand` (runs the stdio loop via `runServer`), `functionsCommand`, `metaCommand`; HELP/dispatch/`COMMAND_NAMES`/value-flags; `capabilities.features.serve=true`, `commands` gains serve/functions/meta.
- **`index.ts`**: export `Session`, `handleRequest`, `setMetadata`.

## 7. Error handling
One-shots: usual envelope/stderr, exit 1 on failure. `serve`: every request yields a JSON-RPC response (result or error); a thrown handler → internal error (-32603) response, loop continues; a malformed line → parse error (-32700), loop continues; `shutdown` (or stdin EOF) ends the loop with exit 0.

## 8. Testing (vitest, TDD)
- **executor**: `seedOutputs` + `runReport({runIds})` runs only the named cells, reusing seeded outputs as scope.
- **Session**: open→stale=all; run→all execute; edit a cell→only it + dependents become stale; subsequent run re-executes only those (assert non-stale cells were NOT re-run, e.g. via an output sentinel / event list); rename/rm update cache/stale; save writes the file.
- **rpc**: `handleRequest` for each method (open/describe/run/cell.*/meta.*/save/capabilities/functions/shutdown); JSON-RPC framing (id echoed; error codes; parse error for bad request); `run` returns events.
- **functions**: `--json` lists known names (`add`, `sin`, …) and constants (`pi`); shape valid.
- **meta**: get returns metadata; set updates title/author/tags and writes the file; round-trips.
- **serve loop (integration)**: spawn `node dist/cli.js serve`, write `open`+`run` lines, assert responses + streamed events on stdout; `shutdown` exits 0.

## 9. Out of scope
Multi-document `serve`; `--expect-hash`/optimistic lock; `fmt`; export (LaTeX/PDF/ipynb); rendering; the Electron GUI itself; auto-run-on-edit (runs are explicit).

## 10. Global constraints
ESM-only; vitest explicit imports; security invariant untouched (cells still only via sandboxed `evaluate`); atomic writes; `tsc --noEmit` gate; Conventional Commits; **no `npm publish`**; Changesets `minor`.

## 11. Acceptance criteria
1. `mtsw serve` answers JSON-RPC `open`→`run` over stdio, streaming `cell/event` notifications, and `shutdown` exits 0; a malformed line yields a parse-error response without crashing.
2. After `cell/edit`, a `run` re-executes only the edited cell + its dependents (cached cells are not re-run) — verified by event/output evidence.
3. `save` persists the in-memory edits atomically.
4. `functions --json` lists callable names + constants; `meta get/set` reads/updates metadata and writes the file.
5. Full suite + `tsc --noEmit` green; security invariant untouched.
