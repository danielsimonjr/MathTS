# tools/

Agent-facing utilities for **understanding and maintaining** the MathTS codebase. These
are NOT part of the shipped library — none is a workspace member, none is built into a
package, and **package `src/` and test files must never import or use them** (provenance
comments citing a benchmark are fine; usage is not). Run them at the repo level.

## Dependency graph

| Tool                                 | What                                                                                                                                                              | Run                                                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create-dependency-graph/` (**CDG**) | Generator: heavy TS parse → the `docs/Architecture/*` artifacts (graph, cycles, reachable/dormant, API, wasm/parallel pairing, coverage). _Legacy nickname: DGT._ | `npm run docs:deps`                                                                                                                              |
| `query-dependency-graph/` (**QDG**)  | Consumer: reads CDG's `dependency-graph.json` (no re-parse) → queries + emits `dependency-reverse.json` / `node-safety.json`.                                     | `npm run docs:graph -- <dependents\|symbol-users\|is-public\|node-safety\|cycles>` · `npm run check:browser-safety` · `npm run docs:deps:derive` |

CDG generates; QDG queries. Deliberately kept separate (heavy parse vs instant read). See
[`docs/FEATURE_WORKFLOW.md`](../docs/FEATURE_WORKFLOW.md).

## Doc / manifest generators (all have a CI `--check` mode)

| Tool                               | What                                                                                        | Run                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `generate-functions-reference.mjs` | Regenerate the "Complete export index" blocks so API docs can't drift from export surfaces. | `npm run docs:functions` · `docs:functions:check` |
| `generate-wasm-manifest.mjs`       | SHA-384-hash every `.wasm` → `wasm-manifest.json` (feeds the WASM integrity invariant).     | `node tools/generate-wasm-manifest.mjs <dir>`     |
| `roadmap-check/`                   | ROADMAP/TODO consistency (npm-version claims + stale-TODO).                                 | `npm run docs:roadmap-check`                      |

## Benchmarks — **two separate trees** (mind the singular/plural)

| Dir                     | Style                      | What                                                                                                                                 | Run                                                                        |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `benchmark/` (singular) | TS via `tsx`, npm-scripted | Maintained suite: `parallel/` (worker break-even), `tensor/`, `wasm/` (JS-vs-AS), `gpu/`.                                            | `npm run bench:parallel\|tensor\|wasm\|elementwise\|special\|sort\|matrix` |
| `benchmarks/` (plural)  | MJS, ad-hoc                | One-off micro-benches: `backend-audit`, `decomp-audit`, `matmul-*`, `elementwise-wasm-*`, `ws2-*`. Needs `npm run build:wasm` first. | `node tools/benchmarks/<file>.mjs`                                         |

Source-code provenance comments cite **both** dirs. (Consolidation is a known cleanup candidate.)

**3-way backend bench (JS/TS vs WASM vs WebGPU)** — `benchmark/gpu/bench-3way.{entry.ts,html}`.
Drives the REAL matrix backends (`jsBackend.multiply`, `WASMBackend.multiply` AS-SIMD,
`GPUBackend.matmul` WebGPU). WebGPU only runs in a browser, so it's esbuild-bundled and
opened as a page: `npm run bench:backends:serve` (builds + serves on :8099 + opens the
page), then click **Run**. `bench:backends:build` just produces the bundle (gitignored
artifact). JS-vs-WASM validated headless (~11× at n=256, f64-exact).

> ⚠️ **WebGPU is experimental, not a production accelerator yet** (unlike the matured
> WASM backend). The WebGPU column exercises the incomplete `GPUBackend` path — a
> forward-looking placeholder to run in a WebGPU-capable browser (Chrome + DevTools)
> **once real WebGPU accelerators land**. Today's real acceleration story is JS vs WASM.

## LLM-context helpers

| Tool                    | What                                                               | Run                                                                             |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `compress-for-context/` | CTON compressor — format-specific compression for context windows. | `npx tsx tools/compress-for-context/compress-for-context.ts <input>`            |
| `chunking-for-files/`   | Split large files into editable chunks + merge back.               | `npx tsx tools/chunking-for-files/chunking-for-files.ts split\|merge\|status …` |

## Correctness & porting

| Tool                      | What                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `math-correctness-audit/` | External-oracle differential test (`eval.mjs` calls built `functions`/`matrix` dist → `outputs.json`; a separate mpmath/scipy oracle compares). |
| `mathjs-port/`            | Manual JS→TS porting workspace (`port_*.py`, `audit_*.py`, `drafts/`) — now the `.ts→.ts` sync is dead.                                         |

## Codebase inventory (Python)

| Tool                                                   | Status                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `build-mathts-inventory.py` · `inventory.py <section>` | Structured inventory → `codebase-inventory.json`.                                      |
| `find-removal-candidates.py`                           | Finds removable non-code files (Dropbox conflicts, sourcemaps).                        |
| `scan-inventory.py`                                    | **Pre-monorepo** — scans the vestigial root `src/`; use CDG/QDG for current structure. |
| `scan_missing.py`                                      | **DEPRECATED** — the `.ts→.ts` mathjs sync is dead (mathjs removed its `.ts` files).   |
