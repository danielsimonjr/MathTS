# Wave-4 Gap-Closure Proposal — Implementation Plan

**Date:** 2026-05-24
**Source:** Operationalises the remaining items from [`FUNCTION_GAPS_AUDIT.md`](./FUNCTION_GAPS_AUDIT.md) — the §D Tier-4 ranks, the §C cross-cutting infrastructure items still pending, and the deferred sub-slice 3.10c-2. Companion to [`GAP_CLOSURE_PROPOSAL.md`](./GAP_CLOSURE_PROPOSAL.md), which closed out Tiers 1–3.
**Status as of opening:** Waves 1–3 done (9 slices landed across commits `4462f69` → `572363f`). 100% effective coverage on active code. 0 circular deps. No new gaps surfaced by the 2026-05-24 audit refresh.

## Slicing strategy

Mirrors the Wave-1/2/3 pattern. Items split into three implementation tiers + one deferred bucket:

| Tier         | Slices                  | Character                                                                  | Dispatch             |
| ------------ | ----------------------- | -------------------------------------------------------------------------- | -------------------- |
| **Tier 1**   | 4.1, 4.2, 4.3, 4.4, 4.5 | Disjoint scopes; pure-JS or small WASM add-on; no shared-file conflicts.   | Parallel (5 agents)  |
| **Tier 2**   | 4.6, 4.7                | Audits + bigger API surfaces; sequenced so design decisions don't collide. | Sequential           |
| **Tier 3**   | 4.8, 4.9                | Design-heavy AD adjoints (4.8); WASM kernel + AS parity (4.9).             | Sequential, one-each |
| **Deferred** | 4.10 (rank 14)          | Blocked on upstream prerequisites.                                         | No dispatch          |

## Tier 1 — Parallel slices (5 agents, disjoint scopes)

### Slice 4.1 — ✅ LANDED in `73e6ca9` — `ComputePool` extras: `pow` + `sign` + `tensordot`

**Goal:** Close the ComputePool API gaps the §C audit flagged. `pow` and `sign` complete the elementwise-math surface beyond trig; `tensordot` enables `Tensor.tensordot` to route through workers above threshold (which `Tensor.contract` already does via the existing matmul kernel).

**Files (your scope only):**

- `parallel/src/ComputePool.ts` — add three new methods (`pow(base, exponent)`, `sign(data)`, `tensordot(a, b, axes)`). Add `'pow'`, `'sign'`, `'tensordot'` to `OpName` and `DEFAULT_THRESHOLD_BY_OP`.
- `packages/workerpool/src/worker.ts` — register kernel handlers if needed (check whether `applyKernel2`/`elementwiseChunk` already cover `pow` via the existing generic dispatcher).
- `parallel/tests/ComputePool.test.ts` — extend with 6+ tests (correctness above/below threshold for each of the three new methods).

**Reference:** `ComputePool.add` (binary elementwise), `ComputePool.sqrt` (unary elementwise), Slice 1.3 (`fe40938`).

**Threshold starting points:** `pow` ≥ 64 K, `sign` ≥ 64 K, `tensordot` ≥ 8 K contracted-axis volume (tune via bench).

**Acceptance:** Correctness within 1e-9 of the JS reference for `pow`/`sign`/`tensordot`; mismatched-length / shape-mismatch errors raised cleanly.

### Slice 4.2 — ✅ LANDED in `8b357cc` — `matrixPinv` — Moore-Penrose pseudoinverse on `DenseMatrix`

**Goal:** Sibling of `tensorPinv` (landed in Slice 2.4 / `70217b7`) on the matrix package. Composes the existing `matrix.svd` primitive with `rcond·max(S)` thresholding.

**Files (your scope only):**

- `matrix/src/operations/pinv.ts` — NEW. `pinv(A: DenseMatrix, opts?: { rcond?: number }) → DenseMatrix`. Algorithm: full SVD via `matrix.svd`, threshold singular values, return `V · diag(s_inv) · Uᵀ`.
- `matrix/src/operations/index.ts` — re-export.
- `matrix/tests/operations/pinv.test.ts` — NEW. 12+ tests covering round-trip `A · pinv(A) · A ≈ A`, rank-deficient cases, tall/wide matrices, rcond threshold behavior.

**Reference:** `tensor/src/operations/pinv.ts` (landed `70217b7`) is your closest template — just strip the permute/reshape outer wrapper since you're working directly on a 2-D matrix.

**Acceptance:** Standard Moore-Penrose identities verified within `1e-10`: `A·A⁺·A = A`, `A⁺·A·A⁺ = A⁺`, `(A·A⁺)ᵀ = A·A⁺`, `(A⁺·A)ᵀ = A⁺·A`. Rank-deficient inputs handled (zero singular values dropped).

### Slice 4.3 — ✅ LANDED in `73e6ca9` + `8b357cc` — `tensor/src/operations/random.ts` QR-cleanup

**Goal:** Internal de-duplication. `random.ts` still has an inline Gram-Schmidt QR for the orthogonal-matrix path; now that `matrix.qr` is public (landed in Slice 1.5), call it instead.

**Files (your scope only):**

- `tensor/src/operations/random.ts` — replace inline Gram-Schmidt with `import { qr as matrixQr } from '@danielsimonjr/mathts-matrix';` and a thin wrapper. Keep the seeded-PRNG outer flow.
- `tensor/tests/operations/random.test.ts` — ensure existing tests still pass; add 2 tests that verify the orthogonal-matrix path produces a matrix `Q` with `Qᵀ · Q ≈ I` within 1e-10.

**Slice boundary:** Pure refactor. No new functionality. No behavioural change visible to consumers.

**Acceptance:** All existing tests pass unchanged. Random orthogonal matrix path delegates through `matrix.qr` (verified by checking imports / removed inline code).

### Slice 4.4 — ✅ LANDED in `8af250b` — `typed/string.ts` promotion (rank 13)

**Goal:** Promote the 5 remaining string-formatting helpers from the dormant synced layer into active typed/-layer dispatch.

**Promoted exports:** `bin`, `hex`, `oct`, `format`, `print`.

**Files (your scope only):**

- `functions/src/typed/string.ts` — NEW. Mirror the structure of `typed/relational.ts` from Slice 1.2 (`7fe73b7`).
- `functions/src/typed/index.ts` — add the re-export.
- `functions/src/factories/index.ts` — strip the `export` keyword from the 5 colliding factory entries (same pattern as bitwise/logical/complex/set/relational).
- `functions/tests/typed-string.test.ts` — NEW. ≥ 20 tests covering each op across number/BigNumber inputs + format-string options.

**Reference:** `functions/src/typed/relational.ts` (landed `7fe73b7`) is the structurally closest precedent — small, pure-JS, no acceleration needed.

**Acceptance:** All 5 ops dispatch typed-only (no parallel/WASM — these are scalar transformations on numbers). Tests cover the standard mathjs formatting behavior (`hex(255) → '0xff'`, `bin(5) → '0b101'`, etc.).

### Slice 4.5 — ✅ LANDED in `6e9f9c0` — Polynomial WASM follow-up: `discriminant` + `resultant`

**Goal:** Close the gap left at the end of Slice 3.7 — those WASM kernels covered `polymul` / `polynomialGCD` / `polynomialLCM` / `polynomialQuotient` / `polynomialRemainder` but explicitly deferred `discriminant` and `resultant` until a Sylvester-matrix-fill helper landed. Now ship it.

**Files (your scope only):**

- `wasm-rust/crates/mathts-wasm/src/poly.rs` — add `poly_resultant_f64(p: &[f64], q: &[f64]) → f64` and `poly_discriminant_f64(p: &[f64]) → f64`. Build the (m+n-2)×(m+n-2) Sylvester matrix, route through the existing det kernel.
- `assembly/src/poly.ts` — AS parity additions (use the existing `det()` from `assembly/src/algebra/decomposition.ts` or inline if not exposed).
- `functions/src/wasm/poly/wasm-bridge.ts` — add `discriminantDispatch` / `resultantDispatch` + JS fallbacks at the existing `WASM_POLY_THRESHOLD = 256` threshold.
- `functions/src/typed/algebra.ts` — wire the dispatch into the existing `discriminant` and `resultant` typed functions.
- `functions/tests/typed-algebra-wasm.test.ts` — extend with 6+ tests (correctness above/below threshold, known reference values e.g. `discriminant([1,-3,2]) = 1`).
- `tools/benchmark/wasm/poly.bench.ts` — extend with discriminant/resultant timing.
- `lib/wasm/wasm-manifest.json` — regenerated via `node tools/generate-wasm-manifest.mjs`.

**Reference:** Slice 3.7 (`6520a76`) — your template for the end-to-end Rust+AS+bridge+typed-wiring chain. The `det` primitive already exists in `wasm-rust/crates/mathts-wasm/src/`.

**Acceptance:** `wasm-integrity.test.ts` still 5/5; new tests pass; bench shows WASM wins above threshold for both ops.

## Tier 2 — Sequential slices

### Slice 4.6 — ✅ LANDED in `43f45a1` — `typed/probability.ts` dedup audit + selective promotion (rank 9)

**Goal:** Promote the genuinely-missing 6 from the synced `probability/` layer while avoiding duplication with the active `typed/distributions.ts` and `typed/special.ts`.

**Audit phase (do first):** For each of the 12 synced files under `functions/src/probability/`, check whether the function is already surfaced (possibly under a different name) by `typed/distributions.ts` or `typed/special.ts`. Build a small markdown table of findings.

**Files (your scope only):**

- `functions/src/typed/probability.ts` — NEW. Promotes the genuinely-missing exports identified by the audit (proposal-defaults: `bernoulli`, `combinations`, `combinationsWithRep`, `multinomial`, `pickRandom`, `randomInt` — but verify, some may already be in `typed/distributions.ts` under different names).
- `functions/src/typed/index.ts` — re-export.
- `functions/src/factories/index.ts` — strip `export` from colliding factory entries.
- `functions/tests/typed-probability.test.ts` — NEW. ≥ 20 tests covering each promoted op including the random-seeded paths.
- `docs/roadmap/FUNCTION_GAPS_AUDIT.md §A` — update the relational row's status with the audit findings and the commit SHA.

**Reference:** `typed/relational.ts` (Slice 1.2) and `typed/set.ts` (Slice 2 of the earlier landing) are the cleanest promotion patterns.

**Acceptance:** No double-promotion (a function already in `typed/distributions.ts` should not appear in `typed/probability.ts` with a different name). Tests pass. Seeded-random paths verified by reproducibility (same seed → same output).

### Slice 4.7 — ✅ LANDED in `13eda2f` — Tensor indexing primitives — core family (rank 11)

**Goal:** NumPy/JAX-style indexing primitives on `Tensor`. The audit's rank-11 entry lists 8 ops: `slice`, `gather`, `scatter`, `concatenate`, `stack`, `pad`, `roll`, `flip`. **This slice lands the core 4 (`slice`, `gather`, `stack`, `concatenate`); `scatter`, `pad`, `roll`, `flip` are deferred to a follow-up sub-slice if scope balloons.**

**Files (your scope only):**

- `tensor/src/operations/slice.ts` — NEW. `slice(t, ranges)` — extract a contiguous sub-tensor by per-axis `[start, stop, step]` triples (JAX-style). Mirror NumPy basic slicing.
- `tensor/src/operations/gather.ts` — NEW. `gather(t, axis, indices)` — pull elements along one axis (NumPy `take` / JAX `gather`).
- `tensor/src/operations/stack.ts` — NEW. `stack(tensors, axis)` — stack same-shape tensors along a new axis (NumPy `stack`).
- `tensor/src/operations/concatenate.ts` — NEW. `concatenate(tensors, axis)` — concat tensors that agree on all axes except the join axis (NumPy `concatenate`).
- `tensor/src/index.ts` — re-export the 4 ops + their result/options types.
- `tensor/tests/operations/{slice,gather,stack,concatenate}.test.ts` — NEW. ≥ 12 tests each, including axis-label propagation and rank-1/2/3/4 cases.

**Reference (read first):** `tensor/src/operations/kron.ts` (landed in Slice 2.4 / `70217b7`) for the axis-label propagation pattern. `tensor/src/Tensor.ts` for the Float64Array-backed storage and stride conventions.

**Axis-label semantics (decide and document):**

- `slice` — preserve labels from the input axes.
- `gather` — preserve the gathered-axis label; mark it as derived (`<original>'`) so it doesn't auto-match in `contract`.
- `stack` — new axis gets `undefined` label by default; accept an optional `newAxisLabel` option.
- `concatenate` — preserve labels from the first input; warn (don't error) if labels disagree among inputs.

**Acceptance:** Round-trip identities (`stack(unstack(t)) ≈ t` if unstack existed — verify by reconstruction); concat of slices equals the original; NumPy reference comparison for a handful of golden cases.

## Tier 3 — Single-agent design-heavy slices

### Slice 4.8 — `TapedTensor` decomposition AD (rank 12) — **Opus subagent**

**Goal:** Reverse-mode AD adjoints for `TapedTensor.tensordot`, `TapedTensor.svd`, `TapedTensor.eig`. Single design-heavy slice — the adjoints have edge cases at repeated singular values / eigenvalues that need explicit handling.

**Files (your scope only):**

- `autograd/src/tape.ts` — add three methods on `TapedTensor`.
- `autograd/tests/tape-decomposition-ad.test.ts` — NEW. ≥ 25 tests including finite-difference checks at well-conditioned inputs, near-degenerate inputs (small singular-value gaps), and explicit documentation of behavior at exact degeneracies.

**Adjoint references (use these — don't invent):**

- **`tensordot`** — Direct extension of the `contract` adjoint already on `TapedTensor`. For `Z = tensordot(A, B, axes)`, `dA = tensordot(dZ, B, ...)`, `dB = tensordot(A, dZ, ...)` with index permutations following the standard chain rule. See Townsend (2016) §6 or the PyTorch autograd source for `torch.tensordot`.
- **`svd`** — Standard reference is Townsend (2016) "Differentiating the Singular Value Decomposition" (the formulas in Giles' "An extended collection of matrix derivative results" §3.4 are equivalent). At repeated singular values the basic formula is singular; use the subgradient / Lyapunov-equation regularization (PyTorch's approach in `torch.linalg.svd.backward`). **Document the choice in a comment.**
- **`eig`** — Symmetric case only for this slice (`symmetric: true` path). General case has complex eigenvalues and is significantly harder; defer to a follow-up. For symmetric: `dA = U · (F ⊙ (Uᵀ · dU)) · Uᵀ + U · diag(dΛ) · Uᵀ` where `F[i,j] = 1/(λ_i - λ_j)` for `i ≠ j`, else 0. At repeated eigenvalues, mask the divide and document.

**Acceptance:**

- Finite-difference check (`h = 1e-5`) at 3+ well-conditioned inputs per op, agreement within `1e-5`.
- Repeated-eigenvalue / repeated-singular-value cases handled without NaN (test explicitly).
- Documentation comment at each adjoint citing the reference + the chosen regularization.

### Slice 4.9 — Slice 3.10c-2: Airy `Ai`/`Bi` WASM + AS Bessel parity

**Goal:** Close out the WASM-route playbook entry for special functions by adding Airy alongside Bessel, plus the AS parity port for both that was wired-for-but-not-implemented during Slice 3.10c-1 (`572363f`).

**Files (your scope only):**

- `wasm-rust/crates/mathts-wasm/src/special.rs` (or extend existing `bessel.rs`) — add `airy_ai_f64(xs: *const f64, n: usize) → Vec<f64>` and `airy_bi_f64(xs: ...)`. Use series + asymptotic expansion per Numerical Recipes §6.7.
- `assembly/src/special.ts` — NEW. AS parity port for all 6 Bessel exports (`bessel_j0/j1/jn/y0/y1/yn_f64`) **and** `airy_ai_f64` / `airy_bi_f64`.
- `assembly/src/index.ts` — re-export.
- `functions/src/wasm/special/wasm-bridge.ts` — add `airyAiDispatch` / `airyBiDispatch` following the existing probe-Rust-then-AS-then-JS pattern. The `_as`-suffix probing is already wired (forward-compat from 3.10c-1).
- `functions/src/wasm/WasmLoader.ts` — register `airy_ai_f64`, `airy_bi_f64`, and the AS-suffix variants (`bessel_j0_f64_as` etc.).
- `functions/src/typed/special.ts` — add array-overload paths for `airyAi` / `airyBi` matching the Bessel pattern.
- `functions/tests/typed-special-wasm.test.ts` — extend with 8+ Airy tests (reference values from DLMF §9.2: `Ai(0) = 1/(3^(2/3)·Γ(2/3)) ≈ 0.355028…`, `Bi(0) = 1/(3^(1/6)·Γ(2/3)) ≈ 0.614927…`, plus a few non-zero points and large-|x| asymptotic checks).
- `lib/wasm/wasm-manifest.json` — regenerated.

**Reference:** Slice 3.10c-1 (`572363f`) is your template. The bridge layout exactly mirrors Bessel's.

**Risk note:** Airy needs asymptotic expansion at large |x| (different from Bessel's series + recurrence path). Allocate time for that. Precision target: ~1e-7 relative error matching Bessel's NR §6 algorithm tradition; document anywhere it diverges.

**Acceptance:** `wasm-integrity.test.ts` 5/5; reference-value tests pass within stated tolerance; AS path no longer "deferred" (post-fix audit refresh should remove the deferral note from `FUNCTION_GAPS_AUDIT.md §B.1`).

## Deferred (no subagent dispatch)

### Slice 4.10 — `typed/unit.ts` (rank 14) — **BLOCKED**

Requires a real `Unit` type in `@danielsimonjr/mathts-core`. None exists today. `to(value, unit)` and `toBest(value)` are one-liner wrappers once the type lands; until then this can't ship.

**Action:** Stays on the TODO. Will dispatch when the upstream `Unit` type is in place.

### B.1 / B.2 playbook backlog

The audit's §B.1 and §B.2 playbooks list 8 WASM-route and 7 worker-route candidates that haven't been picked up. These are explicitly "future wins awaiting consumer pressure" per the audit. **No dispatch in this wave.** They stay on the TODO as a backlog. The full list is reproduced in [`FUNCTION_GAPS_AUDIT.md §B.1`](./FUNCTION_GAPS_AUDIT.md#b1-wasm-route-playbook--pure-js-functions-worth-porting-to-a-wasm-kernel) and [`§B.2`](./FUNCTION_GAPS_AUDIT.md#b2-worker-route-playbook--pure-js-functions-worth-offloading-to-computepool).

### WebGPU browser smoke test

Requires Playwright (or `@vitest/browser`) to be installed at repo root and a CI matrix entry with a software WebGPU adapter (Mesa lavapipe / DX12). This is an infrastructure PR, not an implementation slice. Stays on the TODO awaiting that prerequisite.

## Dispatch plan

**Wave A (parallel — 5 sonnet agents):** Slices 4.1, 4.2, 4.3, 4.4, 4.5.

**Wave B (sequential — 1 sonnet agent each):** Slice 4.6 (depends on nothing in Wave A), then Slice 4.7 (depends on nothing in Wave A).

**Wave C (sequential — 1 agent each):** Slice 4.8 (Opus — design-heavy). Then Slice 4.9 (Sonnet — mirror 3.10c-1).

Each subagent receives:

- The slice ID and the relevant section of this doc.
- Owned file list + sole-owner discipline.
- Acceptance criteria.
- Instructions to run targeted tests + `npm run typecheck` + `npm run lint` + `npm run format` before committing.
- Instructions to update the corresponding row in `FUNCTION_GAPS_AUDIT.md §D` / §B.1 / §C status to ✅ with the commit SHA, and append a per-slice subsection to the `CHANGELOG.md` `[Unreleased]` block.
- The git-push retry-with-backoff policy.

## How to use this document

When a slice lands, change its heading prefix from `### Slice X.Y —` to `### Slice X.Y — ✅ LANDED in <commit-sha>` and tick the corresponding row in `FUNCTION_GAPS_AUDIT.md §D` (or `§C` for non-ranked items). If a slice gets reshaped during implementation (e.g. 4.7 splits into 4.7a + 4.7b), update the heading in place rather than starting a new doc.
