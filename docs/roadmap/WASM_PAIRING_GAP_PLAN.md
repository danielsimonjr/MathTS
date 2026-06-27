# WASM↔Function Pairing — Gap-Closure Plan

**Status:** executed 2026-06-25 · **Drafted:** 2026-06-25 · **Source of truth for
the pairing:** `docs/Architecture/wasm-pairing.md` (regenerate: `npm run docs:deps`)

## Resolution (2026-06-25)

Executed under dev-workflow + honest-claude. Outcome:

- **T4 (detector) — DONE.** `tools/create-dependency-graph` now classifies each
  typed function as `wasm` / `parallel` / `js-only`. The pairing went from a
  misleading "21 accelerated / 197 JS-only" to the honest **27 wasm · 63
  parallel · 128 js-only** (after T3 wired 6 elementwise ops) — the parallel
  functions were always accelerated via the worker pool, just not via a
  `*Dispatch`.
- **T1 (statistics reductions) — NOT WIRED (would regress).** The reduction
  WASM bridge already exists (`functions/src/wasm/statistics/basic.ts` + WASM
  kernels) but is dormant; stats route to `computePool` (threshold `'never'`, so
  effectively synchronous JS). Decision-gate benchmark
  (`tools/benchmark/wasm/reduction.bench.mjs`): **with the realistic JS→wasm
  copy-in, the WASM reduction kernels are 0.4–0.7× the speed of plain JS**
  (correctness exact). Copy is O(n), reduction is O(n), so transfer dominates and
  V8's JIT'd `+=` loop wins. Not wired, per "don't wire a path that loses".
- **T3 (trig/arithmetic elementwise transcendentals) — WIRED (✓ 0.2.13).**
  *Correction:* an earlier draft of this plan declared T2/T3 "not wired,
  strictly worse" — that was **inferred** from T1, not measured. Measuring
  (`tools/benchmark/wasm/elementwise.bench.mjs`) overturned it:
  `abs/sin/cos/tan/exp/log` over `Float64Array` ≥ 1024 are **1.35–5.1× faster**
  than JS *including* copy-in **and** copy-out, because `Math.sin` etc. are
  expensive enough that libm-in-wasm + 2 copies still wins. Wired via
  `functions/src/wasm/elementwise/wasm-bridge.ts` (WASM `simd_*_array`,
  self-managed scratch since the WASM module exports only `memory`).
  `sqrt` excluded (hardware `Math.sqrt` wins, 0.5–0.66×). Verified <1e-12 vs JS.
- **T2 (binary arithmetic add/sub/mul/div) — NOT WIRED (no kernel).** The WASM
  module has no binary elementwise array kernel (only unary `simd_*_array`);
  wiring would require new kernels. Deferred to a kernel-authoring task; low
  priority (binary ops are cheap — like reductions, copy would likely dominate).
- **Special functions (bessel/airy/elliptic/…) — NOT WIRED (measured).** They
  currently fall back to JS (correct, not a crash; the special dispatch's
  allocate is inside its try/catch). Hypothesis: wire them via the elementwise self-scratch pattern for
  a ~2× win. Decision-gate benchmark
  (`tools/benchmark/wasm/special-array.bench.mts`, `npm run bench:special-array`)
  **refuted it**: bessel 0.9–1.2× (break-even), **airy 0.4–0.65× (regresses)**.
  Unlike `Math.sin`, the JS scalar bessel/airy (series+Hankel/asymptotic) are
  already efficient and JIT'd and do the same flops as the WASM kernels, so the
  JS↔wasm copy is pure overhead. Not wired.
> Lesson (rules-for-life #4): never conclude a perf decision by inference —
> measure each case. The reduction result did NOT generalize to elementwise
> transcendentals (those WON); and the elementwise win did NOT generalize to
> special functions (those LOSE — their JS is already fast). Three op classes,
> three different answers, each knowable only by measuring.

### Three-tier gap-fill — executed 2026-06-25 (functions 0.2.14)

Effective-wasm coverage **6 → 18** of 218 typed functions (39 routed). Each tier
benchmark-gated; only measured winners wired.

- **Tier 1 — extend the elementwise win (DONE).** Authored 17 new
  `simd_*_array` WASM kernels; benchmarked (`npm run bench:transcendental`). Wired the
  11 that win at every size: `atan, sinh, tanh, atanh, expm1, log1p, log2,
  log10, sec, csc, cot` (1.4–5× over JS incl. copy). Measured losers left on JS:
  `sqrt, cbrt, asin, acos, cosh, asinh, acosh` (hardware-fast or fast JS).
- **Tier 2 — expensive js-only specials (DONE for the kernel-backed one).**
  `erfc` wired — **5–7×** (its JS is a continued-fraction scalar, far costlier
  than `Math.*`). `digamma/expIntegralEi/sin·cosIntegral` are likely wins too but
  need *authored + mpmath-validated* WASM scalar kernels (no libm equivalent) —
  a separate numerical task, not a libm wrapper. `erf` has no public consumer.
- **Tier 3 — op-fusion (DONE, primitive + public API).** `fuseUnaryChain(ops,
  xs)` (`functions/src/typed/fused.ts`) keeps the array resident in wasm across a
  chain, paying the copy once (`elementwiseChainDispatch` ping-pongs two scratch
  buffers). `npm run bench:fusion`: a 4-op chain runs **2.4–3.1× over JS** and
  beats per-op sequential dispatch. Remaining integration: auto-fusing chains
  inside the expression evaluator (so `evaluate('exp(sin(x))')` fuses) — larger,
  still open.

The task breakdown below is retained as the record of the investigation.

---

This plan closes the gaps between the public typed-function API and the WASM
acceleration layer. It is **agent-driven**: each task is sized for one subagent
and is executed under the **dev-workflow** pipeline (TDD-strict → review →
simplify → re-verify → docs → CHANGELOG → atomic commit) with **honest-claude**
grounding (verify the kernel exists and is correct *before* wiring; benchmark
the real break-even *before* claiming a speedup; never wire a path that doesn't
beat the one it replaces).

---

## 1. The gaps (grounded, 2026-06-25)

The generated pairing reports **21 / 218** typed functions WASM-accelerated. But
that detector only recognizes `*Dispatch` routing, so it both **understates**
real acceleration and **doesn't surface** where SIMD kernels exist but go
unused. Verified routing (`functions/src/typed/*.ts`):

| Family | Array overloads | Current routing | Available SIMD kernels | Gap? |
|---|---|---|---|---|
| `arithmetic` (add/sub/mul/div/scale/abs/sqrt/exp/log…) | yes | **parallel workers (JS), 0 wasm** | `array_add/sub/mul/div/scale/abs/sqrt/exp/log` (assembly) | **G1 — yes** |
| `trigonometry` (sin/cos + others) | yes | **parallel workers (JS), 0 wasm** | `array_sin/array_cos` (assembly) | **G2 — partial** (only sin/cos have kernels) |
| `statistics` (sum/mean/variance/std/min/max/dot/norm) | yes | **mostly parallel (JS); only median/quantile wasm** | `array_sum/mean/variance/stddev/min/max/dot/norm` (assembly) | **G3 — yes** |
| `signal` | yes | **wasm bridge (87 refs)** | welch/bartlett/goertzel/czt/window | no (already wasm) |
| `bitwise` | Int32Array | **wasm bridge (Int32 path)** | bit*_i32_array | no (already wasm) |
| matrix ops | — | wasm via `matrix` backend | gemm/decompositions | no (already wasm) |
| symbolic / string / set / logical / relational / unit / combinatorics / complex-scalar | — | JS (inherent) | none applicable | no (not numeric kernels) |

Plus a **measurement gap**:

- **G4 — the pairing detector is `*Dispatch`-only.** It misses the parallel
  path, the signal/bitwise bridges, and the matrix-backend wasm, so
  "accelerated vs JS-only" is not the real acceleration picture. It should
  classify each function as `wasm` / `parallel` / `wasm+parallel` / `js-only`.

### Honest caveat that shapes everything below

`arithmetic`/`trig` **elementwise** array ops are routed to workers with an
effective threshold of `'never'` (README perf table) — because for pure
elementwise ops the **transfer/marshalling overhead dominates** at the sizes
tested. WASM has the *same* copy-in/copy-out overhead, so wiring `array_add`
will **not automatically be faster**. Therefore:

- **Reductions first** (G3): scalar output, no copy-back of a big array, SIMD
  horizontal-sum wins are real → most likely to beat JS.
- **Elementwise (G1/G2): benchmark-gated.** Wire only above a measured
  break-even; if none exists, the honest outcome is "documented as JS/parallel
  by design," not a forced wasm path.

---

## 2. Execution model

Every task below runs the full **dev-workflow** loop. Shared gates:

- **Correctness gate (honest-claude):** before wiring a kernel, add a
  differential test (`tests/diff-*` pattern, mpmath/numpy or JS-reference
  oracle) proving the WASM kernel matches the JS scalar to <1e-12 across a
  seeded input sweep. No wiring before the kernel is proven correct.
- **Break-even gate:** add a micro-benchmark (`tools/benchmark/wasm/`) for the
  op across sizes; record the size where wasm beats the current path. Wire the
  dispatch threshold to that size. If wasm never wins, **do not wire** — record
  the finding.
- **No-regression gate:** the existing parallel/JS path stays as the fallback;
  full `vitest run` for the package must stay green.

Agent roster (suggested `subagent_type`): `feature-dev:code-architect` (T0
design), `general-purpose` (T1–T4 implementation), `pr-review-toolkit:code-reviewer`
(review step), `code-simplifier` (simplify step).

---

## 3. Tasks

### T0 — Design the special-bridge pattern for elementwise/reduction (architect)
- **Why:** the special-function bridge (`functions/src/wasm/special/wasm-bridge.ts`)
  is the proven template (WASM→JS dispatch, threshold, integrity-checked
  loader, allocate/free). T1–T3 should reuse it, not reinvent.
- **Deliverable:** a short design note + a `functions/src/wasm/elementwise/`
  and `functions/src/wasm/reduction/` bridge skeleton mirroring `special/`.
- **dev-workflow:** plan → review-plan → tasklist. No code beyond skeletons.

### T1 — Statistics reductions → WASM (highest expected value)
- **Scope:** `sum`, `mean`, `variance`, `std`, `min`, `max`, plus `dot`/`norm`
  where applicable, in `functions/src/typed/statistics.ts`, `Float64Array`
  overloads ≥ threshold.
- **Kernels:** `array_sum/mean/variance/stddev/min/max/dot/norm` (assembly);
  verify each exists and is correct first.
- **TDD:** failing differential test (wasm vs JS reduction, seeded sweep,
  <1e-12) → implement `reductionDispatch` + wire overloads → green.
- **Benchmark:** `tools/benchmark/wasm/reduction.bench.ts`; set threshold to the
  measured break-even (expected low, since output is scalar).
- **Gotcha:** variance/std need a numerically-stable kernel (Welford or
  two-pass); verify the assembly kernel's method and tolerance before trusting.

### T2 — Arithmetic elementwise → WASM (benchmark-gated)
- **Scope:** `add`, `subtract`, `multiply`, `divide`, `scale`, plus unary
  `abs`/`sqrt`/`exp`/`log` array overloads.
- **Kernels:** `array_add/sub/mul/div/scale/abs/sqrt/exp/log`.
- **TDD + differential test** as T1.
- **Decision point (honest):** run the break-even benchmark **before** wiring.
  If wasm doesn't beat the current parallel/JS path at any tested size (likely
  for cheap elementwise due to transfer overhead), **stop and document** — do
  not wire a slower path. Consider only the "stay-in-wasm-memory for chained
  ops" variant if a fusion API is in scope (out of scope here; note it).

### T3 — Trigonometry elementwise → WASM (partial; benchmark-gated)
- **Scope:** `sin`, `cos` (only these have `array_sin/array_cos` kernels).
- **Sub-gap:** other trig (`tan`, `asin`, `atan`, hyperbolics, …) have **no**
  array kernel. Either (a) add AssemblyScript `array_tan` etc. kernels (new-kernel
  task, larger) or (b) leave as parallel/JS and document. Default: (b); list
  the missing kernels as a follow-up backlog item.
- Same TDD + benchmark gates as T2.

### T4 — Upgrade the pairing detector (close the measurement gap G4)
- **Scope:** `tools/create-dependency-graph/create-dependency-graph.ts` —
  extend `analyzeWasmPairing` to classify each typed function as
  `wasm` / `parallel` / `wasm+parallel` / `js-only` by also detecting
  `computePool`/`shouldParallelize` (parallel) and non-`*Dispatch` wasm-bridge
  calls (signal, bitwise, matrix backend).
- **TDD:** the tool has no test harness today — add a minimal fixture-based
  check (assert the classifier returns known labels for a handful of known
  functions) before changing the classifier.
- **Output:** `wasm-pairing.{md,json}` gains a `routing` field per function;
  regenerate; update `WASM_ACCELERATION.md` narrative.

---

## 4. Sequencing & ownership

1. **T0** (architect) — design/skeleton.
2. **T4** (parallel, independent) — fix the measurement so we can *see* the real
   gap and validate T1–T3's effect.
3. **T1** (reductions) — highest expected win; do first among the wiring tasks.
4. **T2 / T3** (elementwise) — benchmark-gated; may resolve to "documented, not
   wired" if no break-even.

Each task = one atomic commit (or a clean series), CHANGELOG entry under
`[Unreleased]`, pushed to `main`. Per-package version bumps + `npm publish`
only when a task changes a published package's runtime behavior (T1–T3 change
`functions`; T4 changes only the tool/docs).

---

## 5. Open questions for the maintainer

- **Is elementwise WASM worth pursuing at all** given the transfer-overhead
  ceiling, or should effort concentrate on reductions + a future op-fusion API
  that keeps data resident in WASM memory across chained ops? (My recommendation:
  reductions yes; elementwise only if T2's benchmark shows a win; fusion is the
  real lever but a larger design.)
- **Add missing array kernels** (`array_tan`, full trig/hyperbolic, etc.) to
  AssemblyScript, or accept parallel/JS for those? (Recommend: defer until a consumer
  needs them.)
- **Threshold policy:** reuse `WASM_SPECIAL_THRESHOLD` (1024) or measure
  per-op? (Recommend: per-op from the benchmark; elementwise break-even differs
  from reductions.)
