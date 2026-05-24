# Wave-5 Gap-Closure Proposal — Implementation Plan

**Date:** 2026-05-24
**Source:** Picks up the B.1/B.2 playbook backlog from [`FUNCTION_GAPS_AUDIT.md`](./FUNCTION_GAPS_AUDIT.md) §B.1 and §B.2, plus the non-symmetric `eig` AD deferral from Slice 4.8 and the 4.7b sub-slice (`scatter`/`pad`/`roll`/`flip`) that wasn't shipped in 4.7. **All §D Tier-4 ranks 1-13 are landed; only rank 14 (typed/unit.ts, blocked) and the §B.1/§B.2 backlog remain.** Companion to [`GAP_CLOSURE_PROPOSAL.md`](./GAP_CLOSURE_PROPOSAL.md) and [`GAP_CLOSURE_PROPOSAL_WAVE4.md`](./GAP_CLOSURE_PROPOSAL_WAVE4.md).

**Status as of opening:** Waves 1-4 complete (19 slices across 19 commits). 100% effective coverage on active code, 0 circular deps, pipeline 19/19 green.

## Scoping reality-check

A pre-flight audit found that several B.1 candidates (`expm`/`logm`/`sqrtm`/`pinv` matrix-function wiring) require **matrix-package primitives that don't exist yet** — the audit's B.1 row was speculative. This proposal splits them into "actionable now" vs "needs primitive first" tiers.

## Slicing strategy

| Tier       | Slices               | Character                                                                      | Dispatch             |
| ---------- | -------------------- | ------------------------------------------------------------------------------ | -------------------- |
| **Tier 1** | 5.1, 5.2, 5.10, 5.11 | No new WASM kernels needed; pure-JS or simple promotion; disjoint file scopes. | Parallel (4 agents)  |
| **Tier 2** | 5.3, 5.4, 5.5, 5.6   | WASM kernel ports; mutually exclusive (manifest race).                         | Sequential           |
| **Tier 3** | 5.7, 5.8, 5.9        | Larger design or new primitive needed.                                         | Sequential, one each |
| **Tier 4** | 5.12, 5.13, 5.14     | Worker-route fan-out batches; disjoint scopes.                                 | Parallel (3 agents)  |
| **Tier 5** | 5.15                 | Opus — core Unit type to unblock typed/unit (rank 14).                         | Single agent         |

## Tier 1 — Parallel slices (4 agents, no WASM toolchain churn)

### Slice 5.1 — ✅ LANDED in `09eadea` — Tensor scatter / pad / roll / flip (4.7b)

**Goal:** Complete the NumPy-style indexing primitive family Slice 4.7 deferred.

**Files (your scope only):**

- `tensor/src/operations/scatter.ts` — NEW. `scatter(t, axis, indices, updates)` — inverse of `gather`; writes `updates` at given `indices` along `axis`.
- `tensor/src/operations/pad.ts` — NEW. `pad(t, padWidths, opts?: { mode?: 'constant' | 'edge' | 'reflect'; constantValue?: number })`.
- `tensor/src/operations/roll.ts` — NEW. `roll(t, shifts, axes?)` — cyclic shift along given axes.
- `tensor/src/operations/flip.ts` — NEW. `flip(t, axes)` — reverse element order along given axes.
- `tensor/src/index.ts` — 4 new re-exports.
- `tensor/tests/operations/{scatter,pad,roll,flip}.test.ts` — NEW; ≥ 10 tests each.

**Reference:** Slice 4.7 (`13eda2f`) — `slice.ts` / `gather.ts` / `stack.ts` / `concatenate.ts`. Mirror their axis-label propagation. For `pad`, preserve labels; for `roll`/`flip`, preserve labels; for `scatter`, output keeps input's labels.

### Slice 5.2 — ✅ LANDED in `0cef320` — Promote `matrixPinv` + `matrix.cond` / `norm2` / `normFro` / `lowRankApprox` / `singularValues` to typed/

**Goal:** Several public matrix-package exports (Slice 1.5 + 4.2) aren't reachable through `typed/`. This slice closes that gap so consumers get the same dispatch surface they get for other matrix ops.

**Files (your scope only):**

- `functions/src/typed/matrix-ops.ts` — extend with `pinv`, `cond`, `norm2`, `normFro`, `lowRankApprox`, `singularValues`. Mirror the existing entries in this file (e.g. `eigs`, `svd`).
- `functions/src/factories/index.ts` — strip `export` from any colliding factory entries.
- `functions/tests/typed-matrix-ops.test.ts` — extend with ≥ 12 tests for the new ops.

**Pure promotion** — no new algorithms, just delegate to `matrix.pinv` / `matrix.cond` / etc.

### Slice 5.10 — ✅ LANDED in `6b78c31` — `typed/integration.ts` sub-interval worker fan-out (B.2 row 1)

**Goal:** Extends Slice 3.8 — that slice offloaded the dot-product reduction; this slice offloads the **per-sub-interval** integrand evaluation, which is the natural shape for `gaussQuad` and `romberg` when the user is integrating a closure over many sub-intervals.

**Approach:** Add a `workerCount` option (default = 1 = current behaviour). When `workerCount > 1`, partition the integration domain `[a, b]` into `workerCount` sub-domains, dispatch one task per sub-domain that evaluates `f` and returns the partial sum, then aggregate. The closure `f` must be passed as a stringifiable function (via `f.toString()` + worker `new Function(...)`). Document the closure-string limitation.

**Files (your scope only):**

- `functions/src/typed/integration.ts` — extend `gaussQuad` / `romberg` signatures.
- `parallel/src/ComputePool.ts` — add `integrateChunk` kernel name to `OpName` if not generic.
- `functions/tests/typed-integration-fanout.test.ts` — NEW; ≥ 6 tests covering fan-out correctness + closure-stringification edge cases (must reject non-serialisable closures with a clear message).

### Slice 5.11 — ✅ LANDED in `9f74b1e` — `typed/hypothesis.ts` bootstrap/permutation worker helper (B.2 row 2)

**Goal:** Extends Slice 3.10 — that slice offloaded the post-sort statistical computation; this slice adds a **`bootstrap` opt-in** so consumers can run many independent resampled tests in parallel.

**Approach:** Add `kolmogorovSmirnovTest(sample1, sample2, { bootstrap: N })` etc. variants that internally fan out `N` permutation-resampled test runs via the worker pool, returning the empirical p-value distribution.

**Files (your scope only):**

- `functions/src/typed/hypothesis.ts` — add `bootstrap` option to all four tests.
- `functions/tests/typed-hypothesis-bootstrap.test.ts` — NEW; ≥ 8 tests including reproducibility under a seed.

## Tier 2 — Sequential WASM slices

### Slice 5.3 — ✅ LANDED in `098656e` — `typed/special.ts` elliptic-integral WASM (`ellipticK`, `ellipticE`)

**Goal:** Mirror the Airy pattern from Slice 4.9. AGM (arithmetic-geometric-mean) algorithm — well-conditioned at all `m ∈ [0, 1)`.

**Files:** `wasm-rust/crates/mathts-wasm/src/special/functions.rs` + `bessel.rs` (or new `elliptic.rs`), `assembly/src/special.ts` (extend), `functions/src/wasm/special/wasm-bridge.ts` (extend), `functions/src/wasm/WasmLoader.ts` (extend), `functions/src/typed/special.ts` (extend), `wasm-manifest.json` (regen), new tests in `typed-special-wasm.test.ts`.

**Reference:** Slice 4.9 (`276a75b`). AGM convergence reference: DLMF §19.8.

### Slice 5.4 — ✅ LANDED in `f537a56` — `typed/cas.ts` polynomial-fit WASM (`polyFit`, `chebyshevFit`, `legendreFit`)

**Goal:** Build a Vandermonde matrix and call into the existing `wasm.qrF64` kernel.

**Files:** `wasm-rust/crates/mathts-wasm/src/poly.rs` (extend with `vandermonde_f64`), `assembly/src/poly.ts` (extend), `functions/src/wasm/poly/wasm-bridge.ts` (extend), `functions/src/typed/cas.ts` (wire), tests, manifest.

**Threshold:** `≥ 1024 samples`.

### Slice 5.5 — ✅ LANDED in `2b273a1` — `typed/interpolation.ts` divided-difference WASM (`lagrange`, `newtonInterp`)

**Goal:** O(n²) divided-difference table → WASM kernel. Reuses the existing interpolation bridge from Slice 3.10b.

**Files:** `wasm-rust/crates/mathts-wasm/src/tridiag.rs` (extend or new `interpolation.rs`), `assembly/src/tridiag.ts` (extend), `functions/src/wasm/interpolation/wasm-bridge.ts` (extend), tests, manifest.

**Threshold:** `≥ 256 nodes`.

### Slice 5.6 — ✅ LANDED in `2d0ebfa` — `typed/signal.ts` spectral-windowing WASM (`welchPSD`, `bartlettPSD`, `multiTaperPSD`, `goertzel`, `chirpZTransform`)

**Goal:** Window-application + frame-averaging hot loops. FFT path already WASM (Slice 1 of Wave 1 / earlier). This slice adds `applyWindowF64` and `averagePSDF64` kernels.

**Files:** New `wasm-rust/crates/mathts-wasm/src/signal.rs`, AS port, bridge, typed wiring, tests, manifest.

**Threshold:** `≥ 4096 samples`.

## Tier 3 — Larger / design-heavy slices

### Slice 5.7 — ✅ LANDED as 5.7d in `5a0ca7c` — `wasm.sortF64` kernel + sort-based ops batch (full slice)

**Goal:** Unblocks several B.1 candidates that all depend on a fast sort. Add the kernel, then wire `typed/statistics.ts` `histogram`/`quantile`/`percentile`, `typed/hypothesis.ts` `KS/MW/SW` (which currently keep sort on main thread per Slice 3.10), and `typed/geometry.ts` `convexHull2D`/`convexHull3D`/`delaunay2D`.

**Files:** New Rust + AS sort kernel (probably a SIMD-friendly radix-sort or fall-back to introsort), bridge, then 3 typed-layer rewires. Larger slice; may split into 5.7a (kernel) + 5.7b (statistics wire) + 5.7c (hypothesis re-wire) + 5.7d (geometry wire) if scope balloons.

### Slice 5.8 — ✅ LANDED in `8872e4b` — `wasm.lgammaF64` + distributions pdf WASM (`betaPdf`, `gammaPdf`, `studentTPdf`, `noncentralChi2Pdf`)

**Goal:** New `lgamma_f64` array kernel (most are reachable via `statrs::function::gamma::ln_gamma` already in the Rust crate; check first). Then wire the four pdf functions to use it.

**Files:** Rust kernel addition, AS parity, bridge, typed wiring, tests, manifest.

### Slice 5.9 — ✅ LANDED as 5.9a in `ca08c12` — `matrixExpm` / `matrixLogm` / `matrixSqrtm` primitives + typed wiring

**Goal:** Add matrix-function evaluators using scaling-and-squaring with Padé approximant (Higham 2008). NEW primitives in `matrix/src/operations/expm.ts` + `logm.ts` + `sqrtm.ts`. Then promote to `typed/matrix-ops.ts`.

This is the slice the audit's B.1 row referenced; it requires implementing the primitives first.

## Tier 4 — Parallel worker-route batches (3 agents)

### Slice 5.12 — ✅ LANDED in `effc15e` (co-landed with 5.13) — `typed/dist-objects.ts` batch sampling (B.2 row 4)

Worker-route `Normal.sample(n)` / `Gamma.sample(n)` / etc. when `n ≥ 100_000`.

### Slice 5.13 — ✅ LANDED in `effc15e` — `typed/graph.ts` centrality random-restarts (B.2 row 7)

Worker-route `pageRank` / `betweennessCentrality` / `eigenvectorCentrality` when the consumer passes `restarts: N` ≥ 4.

### Slice 5.14 — ✅ LANDED in `444fec4` — `typed/cas.ts` batch fan-out (B.2 row 6)

Worker-route `simplify`/`derivative`/`expand`/`factor` over batches of expressions when length ≥ 16. Symbolic-tree closure stringification is the hard part (symbolic ops aren't trivially serialisable across worker boundaries — may need to ship the expression source string and re-parse in the worker).

## Tier 5 — Opus: Core Unit type → unblock typed/unit (rank 14)

### Slice 5.15 — ✅ LANDED in `8131212` — `core/Unit` type + `typed/unit.ts` (rank 14)

**Opus agent.** Design and implement a `Unit` type in `@danielsimonjr/mathts-core` covering:

- Dimensional analysis (length, mass, time, etc. as a 7-dimensional vector of rational exponents).
- Unit composition (`m/s²`, `kg·m²/s²`).
- Unit conversion (factor + offset per unit, e.g. `°C` → `K`).
- Pretty-printing.
- Equality / comparison.

Then `typed/unit.ts` promotes `to(value, unit)` and `toBest(value)` as one-liner wrappers.

**Reference:** mathjs's `Unit` class in `mathjs/src/type/unit/Unit.ts`. Port the algorithm; the TS implementation should be cleaner than the JS class-with-prototype.

**Acceptance:** the 50+ mathjs unit-conversion test cases pass through the new Unit type; `typed/unit.ts` exports surface in `functions/src/index.ts`.

## Dispatch plan

**Wave 5A (parallel — 4 sonnet agents):** 5.1, 5.2, 5.10, 5.11.

**Wave 5B (sequential — 1 sonnet agent each):** 5.3 → 5.4 → 5.5 → 5.6.

**Wave 5C (sequential — 1 sonnet agent each):** 5.7 → 5.8 → 5.9.

**Wave 5D (parallel — 3 sonnet agents):** 5.12, 5.13, 5.14.

**Wave 5E (opus, single):** 5.15.

Each subagent receives:

- The slice ID + the relevant section of this doc.
- Owned file list + sole-owner discipline.
- Acceptance criteria.
- Standard "run typecheck + format + lint before commit; HEREDOC commit message with the project footer; push with retry" boilerplate.
- Instruction to update the corresponding row in `FUNCTION_GAPS_AUDIT.md §B` (or §C for non-B.1/B.2 items) and append to CHANGELOG `[Unreleased]`.

## Out of scope for Wave 5

- **3.10c-3 elliptic incomplete** — `ellipticF` (incomplete), `ellipticPi`, Carlson symmetric forms. Deferred — current consumers only need the complete elliptic integrals shipped in 5.3.
- **WebGPU browser smoke test** — still needs the Playwright/CI infra PR first. Stays on the TODO.
- **mathjs upstream sync** — the synced-mathjs layer hasn't been pulled in a while; that's a separate workflow tracked in `docs/roadmap/MATHJS_SYNC_ROADMAP.md`.
