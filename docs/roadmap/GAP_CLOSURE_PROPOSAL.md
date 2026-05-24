# Gap-Closure Proposal — Implementation Plan

**Date:** 2026-05-24
**Source:** Operationalises the prioritised sequencing table in [`FUNCTION_GAPS_AUDIT.md §D`](./FUNCTION_GAPS_AUDIT.md). For each pending rank, this doc gives a concrete file list, design notes, test plan, and slice boundary so the work can be parallelised across subagents.
**Companion:** [`FUNCTION_GAPS.md`](./FUNCTION_GAPS.md) covered the three highest-leverage slices that already shipped in commit `1bfad1e`. This proposal covers what comes next.

## Slicing strategy

The 14 audit ranks split into three tiers based on architectural risk and independence:

| Tier       | Ranks              | Character                                                                       | Dispatch            |
| ---------- | ------------------ | ------------------------------------------------------------------------------- | ------------------- |
| **Tier 1** | 1, 2, 3, 5, 6      | Pure-JS or pure-refactor; disjoint file scopes; no WASM toolchain churn.        | Parallel (5 agents) |
| **Tier 2** | 4                  | New tensor primitives that lean on existing matrix primitives; one agent.       | Single agent        |
| **Tier 3** | 7, 8, 10, 10b, 10c | WASM kernel ports + bridge plumbing + threshold benchmarking; per-slice serial. | Sequenced           |
| **Tier 4** | 9, 11, 12, 13, 14  | Larger or blocked; deferred until upstream blockers resolve.                    | Deferred            |

Tier 1 lands first as one wave of 5 parallel subagents; Tier 2 lands as a follow-up; Tier 3 lands one slice at a time so the WASM build/manifest pipeline doesn't churn. Tier 4 stays on the TODO awaiting consumer pressure or blocker resolution.

## Tier 1 — Parallel slices (5 agents, disjoint scopes)

### Slice 1.1 — ✅ LANDED in `4462f69` — TapedTensor.divide + TapedTensor.sub (rank 1)

**Goal:** Close the autograd symmetry gap. `TapedTensor.add` and `.mul` are tape-aware; their inverses `sub` and `divide` are not.

**Files:**

- `autograd/src/tape.ts` — add two methods on `TapedTensor`.
- `autograd/tests/tape-elementwise-ad.test.ts` — extend with 6+ tests (forward correctness, scalar broadcast, tape-recorded backward, multi-arg chain).

**Adjoints:**

- `divide(a, b)`: `dA = dY / b`, `dB = -dY · a / b²`. Broadcasting follows the same rule as `mul`.
- `sub(a, b)`: `dA = dY`, `dB = -dY`. Broadcasting follows `add`.

**Slice boundary:** Single file plus its existing test file. No cross-package coupling.

**Acceptance:**

- `npx vitest run autograd/tests/tape-elementwise-ad.test.ts` passes.
- Existing autograd tests unchanged.
- Verify numeric gradient at a few inputs matches the analytical adjoint within 1e-7.

### Slice 1.2 — ✅ LANDED in `7fe73b7` — typed/relational.ts promotion (rank 2)

**Goal:** Promote the 7 missing relational ops from the synced `functions/src/relational/` directory into the active `typed/` layer.

**Promoted exports:** `deepEqual`, `unequal`, `compareNatural`, `compareText`, `compareUnits`, `equalScalar`, `equalText`.

**Files:**

- `functions/src/typed/relational.ts` — NEW. Mirror the structure of `typed/complex.ts` / `typed/set.ts` from the Slice-2 landing.
- `functions/src/index.ts` — re-export the 7 names.
- `functions/src/factories/index.ts` — strip the `export` keyword from the colliding factory entries (same pattern as the bitwise+logical+complex+set promotions in commits `2a141d4` and `1bfad1e`).
- `functions/tests/typed-relational.test.ts` — NEW. ≥ 25 tests covering each op across number/Complex/BigNumber/Fraction where applicable, plus negative paths.

**Slice boundary:** Single typed file + one new test file + 2 mechanical edits.

**Acceptance:**

- New tests pass.
- `npm run typecheck --workspace=@danielsimonjr/mathts-functions` clean.
- Synced `functions/src/relational/` directory untouched (still dormant; the typed file delegates).

### Slice 1.3 — ✅ LANDED in `fe40938` — ComputePool.divide (rank 3)

**Goal:** Close the pool API asymmetry — `subtract` exists but `divide` does not.

**Files:**

- `parallel/src/ComputePool.ts` — add `divide(a, b)` method using `applyKernel2` with `(x, y) => x / y`.
- `parallel/src/worker.ts` (or wherever kernel names are registered) — register a `divideChunk` kernel if the existing `applyKernel2` infrastructure doesn't already cover it generically.
- `parallel/tests/ops-elementwise.test.ts` (or the equivalent existing file) — extend with 3+ tests.

**Slice boundary:** Single package, two source files at most.

**Acceptance:**

- Parallel divide of two `Float64Array(1_000_000)` matches the pure-JS reference within numeric tolerance.
- Worker is actually exercised (verify with `WorkerPool.metrics()` if available).

### Slice 1.5 — ✅ LANDED in `c0df3dd` — Promote LU + Cholesky to matrix primitives (rank 5)

**Goal:** De-duplicate. The Doolittle LU and right-looking Cholesky algorithms currently live inlined in `tensor/src/operations/{lu,cholesky}.ts`; promote them to first-class `matrix/src/operations/{lu,cholesky}.ts` primitives and have the tensor layer delegate.

**Files:**

- `matrix/src/operations/lu.ts` — NEW. Move the Doolittle algorithm + the `LUResult` type. Export from `matrix/src/operations/index.ts`.
- `matrix/src/operations/cholesky.ts` — NEW. Move the right-looking algorithm + `CholeskyResult`. Export.
- `tensor/src/operations/lu.ts` — replace inlined algorithm with `import { lu as matrixLU } from '@danielsimonjr/mathts-matrix'; ... return matrixLU(...)`. Keep the permute→reshape outer wrapper.
- `tensor/src/operations/cholesky.ts` — same delegation pattern.
- `matrix/tests/operations/lu.test.ts` + `matrix/tests/operations/cholesky.test.ts` — NEW. Lift the algorithm-level cases from the existing tensor tests.
- `tensor/tests/operations/{lu,cholesky}.test.ts` — keep; they now exercise the delegation path.

**Slice boundary:** Tensor → Matrix package move + delegation. No new functionality.

**Acceptance:**

- All previously-passing tensor lu/cholesky tests still pass.
- New matrix-level tests pass.
- The CHANGELOG follow-up cleanup bullets for "Promote inlined Doolittle LU…" can be marked done.

### Slice 1.6 — ✅ LANDED in `08ce15f` — bench:tensor benchmark suite (rank 6)

**Goal:** Close the perf-measurement gap for the ITensor-parity surface so future regressions show up in CI.

**Files:**

- `tools/benchmark/tensor/contract.bench.ts` — NEW. Benchmark `Tensor.contract` at 3-4 sizes (e.g. 32, 64, 128, 256 cubed).
- `tools/benchmark/tensor/contract-network.bench.ts` — NEW. Benchmark `contractNetwork` on 4, 8, 12, 16 tensors with random shared indices.
- `tools/benchmark/tensor/tensordot.bench.ts` — NEW.
- `tools/benchmark/tensor/decompositions.bench.ts` — NEW. tensorQr, tensorSvd (truncated), tensorEig (symmetric path).
- `package.json` (root) — add `bench:tensor` script that runs the four files.
- `docs/roadmap/ACCELERATION_BENCHMARKS.md` — extend with a Tensor section referencing the new suite.

**Slice boundary:** New files only + one script entry. No source-code changes.

**Acceptance:**

- `npm run bench:tensor` runs to completion; baseline numbers captured in the doc.

## Tier 2 — Sequential slice

### Slice 2.4 — tensorPinv + tensorSolve + tensorKron (rank 4)

**Goal:** Three common ML/stats primitives the ITensor proposal called out but the audit deferred until the QR/LU/Cholesky landing finished. Now that those primitives exist, these are direct compositions.

**Files:**

- `tensor/src/operations/pinv.ts` — NEW. `tensorPinv(t, rowAxes, {rcond})` permute→reshape→`matrix.svd`→threshold→reassemble. Adjoint is straightforward but out-of-scope for this slice (autograd version comes in Tier 4 / rank 12).
- `tensor/src/operations/solve.ts` — NEW. `tensorSolve(A, b, {indexA, indexB})` — solves the linear system `A · x = b` matching by named `Index`. Uses `matrix.lu` (now public after Slice 1.5) then back-substitutes.
- `tensor/src/operations/kron.ts` — NEW. `tensorKron(a, b)` — Kronecker product preserving named indices (concatenates the index lists).
- `tensor/src/index.ts` — re-export.
- `tensor/tests/operations/{pinv,solve,kron}.test.ts` — NEW. ≥ 15 tests each.

**Dependency:** Slice 1.5 must land first (this slice imports `matrix.lu`).

**Acceptance:**

- Round-trip tests: `A · pinv(A) · A ≈ A`; `solve(A, A·x) ≈ x`; `kron` size and identity matrices match NumPy reference.

## Tier 3 — WASM-route slices (sequenced, one at a time)

These follow the §B.4 7-step pattern from `FUNCTION_GAPS_AUDIT.md`. Each slice ends with a `bench:wasm` pass that sets the per-op `minElements` threshold.

### Slice 3.7 — typed/algebra.ts polynomial WASM ports (rank 7)

**Goal:** WASM kernels for the polynomial hot loops.

**Kernels to add:**

- `wasm.polyMulF64(a: F64Array, b: F64Array) → F64Array` (O(n·m) convolution).
- `wasm.polyDivModF64(num: F64Array, den: F64Array) → { quotient, remainder }` (long division).
- `wasm.polyAddF64` (linear-time; optional — likely not worth the marshal cost; bench-then-decide).

**Files:**

- `wasm-rust/crates/<crate>/src/poly.rs` — NEW. `#[wasm_bindgen]` exports.
- `assembly/src/poly.ts` — AS parity port.
- `wasm-manifest.json` — regenerate.
- `functions/src/wasm/poly/wasm-bridge.ts` — NEW. Threshold gate.
- `functions/src/typed/algebra.ts` — wire the bridge into `polymul`, `polynomialGCD`, `polynomialLCM`, `polynomialQuotient`, `polynomialRemainder`. (Discriminant and resultant come in a follow-up after the Sylvester-fill helper lands.)
- `tools/benchmark/wasm/poly.bench.ts` — NEW.

**Threshold starting point:** `minElements = 256` coefficients (tune via bench).

**Acceptance:** Same as the bitwise port — WASM path measurably faster than JS at the chosen threshold; below threshold the JS path stays.

### Slice 3.8 — typed/integration.ts worker dispatch (rank 8)

**Goal:** Worker-route the integration ops over big sub-interval counts.

**Files:**

- `functions/src/typed/integration.ts` — wire `ComputePool` for `gaussQuad` and `romberg` when sub-interval count ≥ threshold. `trapz` and `simpson` over big arrays get a parallel reduction.
- `tools/benchmark/parallel/integration.bench.ts` — NEW.

**Threshold starting point:** ≥ 64 sub-intervals for `gaussQuad`/`romberg`; ≥ 65,536 samples for `trapz`/`simpson`.

**Acceptance:** Bench shows worker dispatch wins above threshold; existing serial path correct below.

### Slice 3.10 — typed/hypothesis.ts worker dispatch (rank 10)

**Goal:** Same pattern as integration; worker-route the four big tests at high sample counts.

**Files:**

- `functions/src/typed/hypothesis.ts` — wire `ComputePool` for `kolmogorovSmirnovTest`, `mannWhitneyTest`, `shapiroWilkTest`, `chiSquareTest` at sample sizes ≥ threshold.
- `tools/benchmark/parallel/hypothesis.bench.ts` — NEW.

**Threshold starting point:** ≥ 4096 samples.

### Slice 3.10b — typed/interpolation.ts tridiag-solve WASM (rank 10b)

**Goal:** WASM kernel for the tridiagonal-solve hot loop of `cubicSpline`, `pchip`, `akima`.

**Kernels to add:**

- `wasm.tridiagSolveF64(diag, lower, upper, rhs) → F64Array` (Thomas algorithm).

**Files:**

- `wasm-rust/crates/<crate>/src/tridiag.rs` — NEW.
- `assembly/src/tridiag.ts` — AS port.
- `functions/src/wasm/interpolation/wasm-bridge.ts` — NEW.
- `functions/src/typed/interpolation.ts` — wire the bridge.
- `tools/benchmark/wasm/tridiag.bench.ts` — NEW.

**Threshold starting point:** `minElements = 1024` knots.

### Slice 3.10c — typed/special.ts Bessel/Airy WASM family (rank 10c)

**Goal:** Per-element transcendental WASM kernels for the special-function family operating over arrays.

**Kernels to add:**

- `wasm.besselJF64`, `wasm.besselYF64`, `wasm.airyAiF64`, `wasm.airyBiF64`.

**Files:**

- `wasm-rust/crates/<crate>/src/special.rs` — NEW (lift from Cephes or use the existing `statrs` crate where coverage exists).
- `assembly/src/special.ts` — AS port (more involved; consider deferring AS parity if scope balloons).
- `functions/src/wasm/special/wasm-bridge.ts` — NEW.
- `functions/src/typed/special.ts` — wire the bridge for array inputs (≥ threshold).
- `tools/benchmark/wasm/special.bench.ts` — NEW.

**Threshold starting point:** `minElements = 1024`.

**Risk note:** Largest of the Tier-3 slices (~300 LOC across the family). May land in two sub-slices: 3.10c-1 (Bessel) and 3.10c-2 (Airy + elliptic).

## Tier 4 — Deferred

Items left on the TODO awaiting consumer pressure or blocker resolution. **No subagent dispatch.**

| Rank | Item                                               | Blocker / rationale                                                                                |
| ---- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 9    | typed/probability.ts audit + selective promotion   | Needs the dedup audit against `distributions.ts`/`special.ts` first. Cheap but not yet justified.  |
| 11   | Tensor.slice / gather / stack / concatenate family | Bigger surface; not blocking any current consumer.                                                 |
| 12   | TapedTensor.tensordot / svd / eig                  | Decomposition adjoints have edge cases (repeated eigenvalues / singular values). Own design slice. |
| 13   | typed/string.ts                                    | Formatter helpers; rounds out the mathjs API but no downstream consumer is blocking.               |
| 14   | typed/unit.ts                                      | Blocked on a real `Unit` type landing in `core` first.                                             |

## Dispatch plan

**Wave 1 (parallel — 5 agents):** Slices 1.1, 1.2, 1.3, 1.5, 1.6.

**Wave 2 (follow-up — 1 agent):** Slice 2.4 (depends on 1.5).

**Wave 3 (sequenced — 1 slice at a time):** Slices 3.7, 3.8, 3.10, 3.10b, 3.10c — one PR per slice so WASM build/manifest churn stays manageable.

Each subagent works in its own file scope to avoid merge conflicts and is given:

- The slice ID + the relevant section of this doc.
- The list of files it owns.
- The acceptance criteria.
- An instruction to run targeted tests + a final `npm run typecheck` + `npm run lint` before reporting back.
- An instruction to update the corresponding row in the audit's §D sequencing table to ✅ with the commit SHA, and to append to the CHANGELOG `[Unreleased]` block.

## How to use this document

When a slice lands, change its heading prefix from `### Slice X.Y —` to `### Slice X.Y — ✅ LANDED in <commit-sha>` and tick the corresponding row in `FUNCTION_GAPS_AUDIT.md §D`. If a slice gets reshaped during implementation (e.g. 3.10c splits into 3.10c-1 + 3.10c-2), update the heading in place rather than starting a new doc.
