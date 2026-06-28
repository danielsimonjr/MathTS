---
"@danielsimonjr/mathts-workbook": minor
---

Persistent `serve` session + incremental re-execution + `functions`/`meta` commands.

- **`mtsw serve`** — a single-document JSON-RPC 2.0 server over stdio (NDJSON): one long-lived process the GUI/tooling attaches to. Methods `open`/`describe`/`validate`/`graph`/`run`/`cell.*`/`meta.*`/`save`/`capabilities`/`functions`/`shutdown`; `run` streams `cell/event` notifications. Requests are serialized (strict order); malformed lines and handler errors yield JSON-RPC errors without crashing; `shutdown`/EOF/SIGINT/SIGTERM exit cleanly.
- **Incremental re-execution** — a `Session` holds the workbook with a per-cell result cache and a stale set computed by **diffing** cell canonical forms; an edit marks the changed cells and their transitive dependents stale, and a `run` re-executes only those (reusing cached outputs as scope). Failed cells stay stale so they are retried (never served or seeded as a valid result). Backed by `executor.seedOutputs` + `runReport({ runIds })`.
- **`functions [--json]`** — list the functions/constants code cells can call (autocomplete data).
- **`meta get|set <file>`** — read/update workbook-level metadata (title/author/description/tags), atomic write.
- New exports: `Session`, `handleRequest`, `setMetadata`, `VERSION`. New internal modules `session.ts`/`rpc.ts`/`doc.ts`/`introspect.ts`/`fs-atomic.ts` (pure router + pure incremental core for testability).

Reviewed (Adam/Eve + code-reviewer): incremental cache correctness (errored cells stay stale; diff-based invalidation), strict request ordering + EOF queue-drain (caught by the loop test), stable-stringified canonical form. Tests 208 -> 232; tsc clean. Known limitations (documented): events flushed before the response (not mid-run), last-write-wins concurrency, no stdout backpressure handling (trusted local client).
