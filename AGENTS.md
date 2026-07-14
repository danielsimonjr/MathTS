# AGENTS.md

> ACFS: v1 · Cross-agent operating guide for **MathTS**.
> Claude Code users: `CLAUDE.md` is auto-loaded and holds Claude-specific
> invariants + the full monorepo reference. This file is the tool-agnostic
> supplement — build/test rules, file boundaries, and a "where to find X" map.
> When they conflict, the more specific/recent source wins; report the conflict.

MathTS is a TypeScript rewrite of mathjs with WASM / WebGPU / WebWorker
acceleration, plus a reactive `.mtsw` Scientific Workbook. npm-workspaces
monorepo (24 packages) orchestrated by Turborepo. All packages are ESM-only,
target ES2022, bundle with `tsup`, test with `vitest`. See `README.md` for the
human-facing overview.

---

## Build / Test / Verify (run from repo root)

| Task          | Command                                                 | Notes                                                                                          |
| ------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Build all     | `npm run build`                                         | turbo, respects dep graph                                                                      |
| Typecheck all | `npm run typecheck`                                     | turbo; **green baseline = 32/32, 0 errors**                                                    |
| Test all      | `npm run test`                                          | vitest via turbo                                                                               |
| Lint / format | `npm run lint` · `npm run format`                       | eslint + prettier                                                                              |
| Coverage      | `npm run test:coverage`                                 | measurement scoped to an include-list in vitest.config.ts                                      |
| One package   | `npx turbo <task> --filter=@danielsimonjr/mathts-<pkg>` |                                                                                                |
| One test file | `npx vitest run <path>`                                 | e.g. `core/tests/utils.test.ts`                                                                |
| WASM (AS)     | `npm run build:wasm`                                    | AssemblyScript — the **sole** WASM backend (functions + matrix); falls back to JS if not built |

**Before claiming "done":** run `npm run typecheck` (must stay 0 errors) and the
affected package's tests. Don't bypass the pre-commit hook (`--no-verify`).

---

## functions/ is now a single active graph (the dormant layer was deleted)

There used to be a "two-layer" rule here (active vs. dormant). **It no longer
applies.** On 2026-06-27 the dormant layer — unexported, unreachable, untested
synced-mathjs code — was deleted (**455 files / ~58.6k LOC** across `functions/`

- `core/`, the bulk being the dead `functions/src/expression/` mirror). The
  `.ts→.ts` mathjs sync model that produced it is dead (upstream TS-split,
  2026-04-10).

What remains in `functions/src/` is **all reachable from
`functions/src/index.ts`** — one active graph:

- ✅ `typed/` (typed-dispatch impls) + `typed/cas.ts`
- ✅ `factories/` — **activated** mathjs leaf factories, re-exported from
  `index.ts` (these import the surviving category dirs `arithmetic/`, `algebra/`,
  `type/`, `utils/`, `plain/`, … — those are now ACTIVE, edit them normally)
- ✅ `wasm/` bridges (`*Dispatch`, `WasmLoader`, `integrity`) + the wired
  expression evaluator `factories/evaluate.ts` (`evaluate` / `compileExpr` /
  `parse`, backed by the `expression` package)

A few legacy synced files were intentionally KEPT because direct tests exercise
them: `functions/src/signal/{fft,conv}.ts` and `functions/src/type/local/Decimal.ts`.

> ⚠️ **There are THREE different `fft`s in this repo. Know which one you are touching.**
>
> | symbol                     | where                                          | who reaches it                                                                  |
> | -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
> | `fft` (**the public one**) | `functions/src/matrix/fft.ts` (mathjs factory) | `import { fft } from '@danielsimonjr/mathts-functions'`                         |
> | `parallelFFT`              | `functions/src/typed/signal.ts`                | exported as `parallelFFT`; Float64Array in/out; routes to the GPU when opted in |
> | `fft` (**not exported**)   | `functions/src/signal/fft.ts`                  | internal — backs `conv.ts` only                                                 |
>
> All three now share one core: **`functions/src/signal/fft-core-f64.ts`**. Optimising the wrong
> one and publishing a claim about it is a mistake that has already been made here — verify with
> `import * as F from '@danielsimonjr/mathts-functions'; F.fft === F.parallelFFT` (it is `false`).
> (The vestigial pre-migration AssemblyScript-source-as-`.ts` under `functions/src/wasm/`
> was deleted 2026-06-27 — the real WASM backend is `assembly/src/`; only the active
> JS dispatch bridges + loader remain in `functions/src/wasm/`.)

`functions/tsconfig.json` now uses `strict:true` (flipped 2026-06-27). The
former ~430 strict violations across the active graph (activated factories +
path-mapped `expression`/`core`) were fixed honestly — the dominant root cause
was typed-function dispatch rejecting concrete-typed impls under
`strictFunctionTypes` (fixed via `MathTSTyped`/`SignatureImpl` using `never[]`
input-position param types). Trust the **export surface in
`functions/src/index.ts` + a green `npm run typecheck`** as the source of truth.

> ⚠️ The `docs/inventory/` reports (dated 2026-04-10) are stale: they predate
> factory activation, evaluator wiring, AND this dormant purge. Do not trust
> their file counts or the active/dormant framing in `02-synced-factories.md`.

---

## Where to find X (navigation hub)

| You want…                                                                                  | Look in                                                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Numeric types (Complex/Fraction/BigNumber), typed-function, factory                        | `core/src/`                                                                     |
| Dense/Sparse matrix, JS/WASM/GPU backends, BackendManager, decompositions                  | `matrix/src/`                                                                   |
| **Shared WebGPU foundation** (GPUContext, BufferPool, ShaderManager, `serializeGpu`, flag) | `gpu/src/` (`@danielsimonjr/mathts-gpu`)                                        |
| **GPU kernels** (element-wise chain, fused chain+reduce, FFT)                              | `functions/src/gpu/`                                                            |
| Rank-N Tensor (Float64Array)                                                               | `tensor/src/`                                                                   |
| Autodiff (forward DualTensor, reverse Tape)                                                | `autograd/src/`                                                                 |
| **Live** math functions (arithmetic, trig, stats, signal, CAS, …)                          | `functions/src/typed/`, `functions/src/factories/`                              |
| ComputePool / WebWorker ops                                                                | `parallel/src/`                                                                 |
| Expression parser/compiler/evaluator                                                       | `expression/src/` (wired via `functions/src/factories/evaluate.ts`)             |
| `.mtsw` notebook runtime (parser, graph, executor)                                         | `workbook/src/`                                                                 |
| mathjs-compat shim (`create(all)`)                                                         | `compat/src/`                                                                   |
| AssemblyScript WASM source (the sole WASM backend — functions + matrix)                    | `assembly/src/`                                                                 |
| Forked typed-function / workerpool                                                         | `packages/typed-function/`, `packages/workerpool/`                              |
| Thin re-export packages (parser, ast, units, linalg, arithmetic, …)                        | top-level dirs; they re-export, no impl                                         |
| Architecture / API / inventory docs                                                        | `docs/Architecture/`, `docs/api/`, `docs/inventory/`                            |
| Roadmaps, gap analyses, WASM plans                                                         | `docs/roadmap/` (active); dated one-off plans archived in `docs/archive/plans/` |
| Standalone tools (dep-graph, benchmarks, mathjs-port)                                      | `tools/`                                                                        |

Dependency graph and per-package details live in **`CLAUDE.md` → Monorepo
Structure**. Don't duplicate it here — reference it.

> **✅ WASM backend.** AssemblyScript is the
> **sole WASM backend** for the whole repo. Both `functions` and `matrix` load
> the AssemblyScript binary `mathts-as.wasm` (source `assembly/src/`); dispatch is
> **AS→JS**. The legacy native-WASM path and its toolchain have been removed.
> SHA-384 integrity verification of the AS binary is
> retained. A few kernels (poly fits, Airy Ai/Bi, argsort/rank) deliberately stay
> on JS where their AS kernels are still being stabilized.

---

## Acceleration tiers — and how to not lie about them

Four tiers: **JS → parallel (worker pool) → WASM (AssemblyScript) → WebGPU (f32, opt-in)**.
Which one wins is **per-kernel and measured**, never assumed.

**The GPU tier is OFF by default.** `enableGpu()` is the caller's consent to f32 precision; with
the flag off, every path is bit-identical f64. Every GPU dispatch is **never-throw**: it returns
`null` (unavailable / not opted in / below threshold / unsupported op) and the caller falls
through to the exact CPU path.

**Thresholds are per-kernel, not global.** `GPU_MIN_ELEMENTS` (65,536) suits the memory-bound
element-wise chain. The **FFT's threshold is 262,144** — at 65,536 the GPU wins by only 1.17×,
inside the noise and nowhere near enough to trade f64 for f32 (an FFT makes log₂(n) passes, so it
amortises the upload more slowly). A shared threshold is convenient and wrong.

**Things that are deliberately NOT accelerated** — each is a measured loss, not a gap:

- A **standalone GPU reduction** (`ops: []`) — uploads n floats to return one number; 3–9× slower
  than a plain JS sum. Declined on purpose.
- A **single** element-wise op on the GPU — pure transfer tax. Only a _fused chain_ pays.
- The **WASM FFT kernel** — 6× SLOWER than the flat JS core (1039 ms vs 170 ms at n=2²⁰).
  Unreachable from any public export. **Do not wire it up assuming "WASM is faster".**

### Benchmarking rules (learned the hard way — the tier order was wrong TWICE)

1. **Measure the path the caller ACTUALLY takes.** Read the dispatch branch. A GPU speedup was
   published against `fftCoreFloat64` while `parallelFFT` was really taking the worker path at
   every size where the GPU engages. Claimed 8.5×; real ~3×.
2. **Measure the symbol a consumer IMPORTS**, not a source file you assume is it. This repo has
   three different `fft`s; the public one was not the one being optimised.
3. **Warm the JIT** (≥5 reps) — a cold baseline inflated a CPU number 3×.
4. **Never `TypedArray.from(typedArray)`** — it is the generic per-element `ToNumber` path,
   ~73× slower than the constructor (433 ms vs 5.9 ms at n=2²⁰). It has corrupted a benchmark,
   a dispatch, and a JS fallback in this repo. Use `new Float32Array(x)`.
5. **A `null` return must FAIL the benchmark**, never be timed as ~0 ms. A dead tier once
   reported as "infinitely fast".
6. **Re-measure ALL tiers in ONE run** before trusting a ranking, and **commit the benchmark** —
   a published table nothing regenerates will rot.
7. **Gate on a reproducible row.** The crossover row is by construction the most marginal and the
   most load-sensitive; assert where the margin is robust and print the rest.

---

## Browser / WebGPU testing

- `npm run test:browser` → `vitest.config.browser.ts` (Playwright). Local uses **system Chrome,
  headed** — Playwright's bundled `chrome-headless-shell` has **no GPU adapter**, which once made
  the whole suite a silent no-op. CI uses full Chromium in new-headless mode; the config is
  keyed off `process.env.CI`.
- **CI has a WebGPU adapter, and it is SOFTWARE (SwiftShader).** So `skipIf(!adapter)` does **not**
  skip there. Two consequences:
  - **Perf assertions must gate on `REAL_GPU`** (`functions/tests/helpers/gpu-hardware.ts`).
  - **f32 tolerances must come from the WGSL spec, not from your card.** WGSL only promises
    `sin`/`cos` to 2⁻¹¹ (~4.9e-4) _absolute_; SwiftShader spends that allowance where NVIDIA does
    not. Use `F32_REL_TOL` / `PEAK_REL_TOL`, which are adapter-gated.
- Wall-clock CPU benchmarks live in `tests/benchmark/` and run **isolated** via
  `npm run test:bench` (`vitest.config.bench.ts`, single-threaded). In the aggregate they measure
  machine contention, not code.

### WGSL gotchas (all cost real time)

- `shared` is a **reserved word**.
- WGSL **const-folds** `bitcast<f32>(0x7fc00000u)` even inside a function body and then rejects
  NaN/±Inf. Pass IEEE bit patterns in via a **uniform**.
- WGSL leaves `log(x<=0)`, `atanh(|x|>=1)`, and division by zero **indeterminate** — guard them or
  the GPU disagrees with JS.
- **A validation error does NOT throw.** It invalidates the command buffer, `submit()` does
  nothing, and the zero-initialised staging buffer reads back as **zeros** — a silently wrong
  answer. Check device limits _and_ use `pushErrorScope('validation')`.
- The error scope is a **per-device LIFO stack**, so concurrent dispatches pop each other's scope.
  Every GPU entry point must funnel through the shared `serializeGpu` (in `gpu/src/`).
- `BufferPool` rounds sizes **up** — bounds-check against an `n` uniform, never `arrayLength()`.

---

## File boundaries & conventions

- **Import extensions:** use `.js` (ESM resolution). Exception: `tensor/src/`
  uses bare relative imports (tsup bundles it). Match the existing style per
  package — check a sibling file before adding imports.
- **Naming:** files `kebab-case.ts`, classes `PascalCase`, functions/vars
  `camelCase`, constants `UPPER_SNAKE_CASE`.
- **Commits:** Conventional Commits (`feat(matrix):`, `fix(workbook):`). Atomic.
- **Re-export packages** (`parser/`, `ast/`, `evaluator/`, `units/`, `numbers/`,
  `linalg/`, `arithmetic/`, `trigonometry/`, `statistics/`, `signal/`) contain
  **no implementation** — edit the source package they re-export, not these.
- **Carry work to RELEASED.** Versioning is via Changesets. An older revision of this file said
  "don't `npm publish` (2FA-gated)" — that is **no longer true** and was stranding work
  undeployed. The flow is: changeset → commit → push → CI opens a "Version Packages" PR → merge
  it → publish. CI cannot publish today (the repo's `NPM_TOKEN` secret is empty), so the session
  lead runs `npx changeset publish` locally, then `git push --tags`.
  **Then verify against the registry, not the publish log** — `npm pack` the published tarball
  into a clean dir _outside_ `~` and typecheck a real consumer against it with
  `skipLibCheck: false`. A green repo gate is not a working package.

---

## Security invariants — DO NOT REGRESS

From the 2026-05-01 security release. Any change touching these must preserve them
(regression tests guard each):

1. **WASM SHA-384 verification.** `functions/src/wasm/WasmLoader.ts` and
   `assembly/src/bindings/wasm-loader.ts` hash the `.wasm` buffer against
   `wasm-manifest.json` before instantiate. Never weaken/skip — even on streaming
   compile. Test: `functions/tests/security/wasm-integrity.test.ts`.
2. **Expression sandbox.** All property/method access in `expression/src/` must
   go through `getSafeProperty`/`setSafeProperty`/`getSafeMethod`
   (`expression/src/utils/customs.ts`). No direct `obj[name]`. Test:
   `expression/tests/security/sandbox.test.ts`.
3. **WorkerPool timeout.** `parallel/src/WorkerPool.ts#execute()` `timeoutMs` +
   hung-worker replacement plumbing must stay.

---

## Testing protocol

- Always `import { describe, it, expect } from 'vitest'` explicitly (the
  `globals` setting is inconsistent across package configs).
- Test files: `*.test.ts` colocated in each package's `tests/`.
  Cross-package: `tests/integration/`, `tests/wasm/`.
- `assembly/tests/run.js` is a node runner (not vitest), needs
  `--experimental-wasm-simd`.
- **Stale-`dist` gotcha:** a package's tests import the _built_ `dist/` of its
  dependencies (workspace resolution), **not** their `src/`. So after editing a
  dependency (e.g. `core`), a direct `npx vitest run` in a downstream package
  (e.g. `autograd`, `functions`) runs against a **stale `dist`** and can report
  false failures — e.g. a new `core` export shows as `undefined`. Fix: rebuild the
  changed dependency first (`npx turbo build --filter=<pkg>` or its `tsup` build),
  or run the suite via `npm run test` (turbo `test` depends on `["^build","build"]`,
  so `dist/` is fresh). Don't chase a downstream test failure until the deps are built.
- **Partial-`tsup` gotcha:** running `tsup src/index.ts --clean` by hand for a quick
  rebuild wipes `dist/` but skips a package's _other_ build steps (e.g. copying
  `mathts-as.wasm` into `functions/dist/wasm/`), leaving an incomplete `dist`. Use the
  package's full `build` script (via turbo) when the wasm binary or `.d.ts` tree matters.

---

## Context File Suite

This project uses the Agentic Context File Suite (ACFS):

- `README.md` — Project identity (human-facing)
- `AGENTS.md` — This file. Cross-agent behavior rules.
- `CLAUDE.md` — Claude-specific invariants + full monorepo reference. Complements
  this file (auto-loaded by Claude Code).
- `CHANGELOG.md` — Project history. Consult before breaking changes.
- `docs/` — Architecture, API, inventory, roadmaps, plans.

There is no project-scoped `memory/` or `wiki/` yet (Standard/Full tiers).
Add them via the `documentation` skill if multi-session memory becomes useful.

### Context File Maintenance

| File              | Update trigger                                         | Who           |
| ----------------- | ------------------------------------------------------ | ------------- |
| `README.md`       | Major project changes                                  | Human         |
| `AGENTS.md`       | New conventions/tools/agent feedback                   | Human + agent |
| `CLAUDE.md`       | Claude-specific invariants, structure changes          | Human + agent |
| `CHANGELOG.md`    | Every release                                          | Human + agent |
| `docs/inventory/` | After large feature/activation waves (currently stale) | Agent         |
