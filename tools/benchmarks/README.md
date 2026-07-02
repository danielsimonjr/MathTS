# Benchmarks

Standalone reproducible micro-benchmarks (not a workspace member). Run with a plain
`node tools/benchmarks/<file>.mjs` from the repo root (needs `npm run build:wasm` first so
`assembly/build/mathts.wasm` exists).

## `elementwise-wasm-single.mjs` / `elementwise-wasm-chain.mjs` — the B8 acceleration spike

**Question (B8):** does routing tensor/autograd element-wise ops through the WASM batch
kernels (`array_exp` etc.) beat V8's JIT of a `Math.*` loop? Measured before building, so we
don't ship an assumed win.

**Finding (2026-07-01, Node 24, this machine):**

> ⚠️ **Superseded — read the Conclusion below.** The "single op loses 0.85–0.95×" row was an
> over-generalization: a re-run + the maintained `bench:elementwise` disagree, and the loss was
> never established against the _real_ production alternative (`computePool.<op>`, not a bare loop).
> The transcendental WASM path was **kept**. Table retained as the original snapshot.

| Path                                                             | Result                                              | Why                                                                                                                                       |
| ---------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Single op** (`exp`), 256 – 1 048 576 elements                  | **WASM loses, 0.85–0.95×**                          | AssemblyScript's scalar `exp` is not faster than V8's native libm `Math.exp`, and the WASM path pays a `Float64Array` copy-in + copy-out. |
| **3-op fused chain** (`sinh(exp(sin x))`, data resident in WASM) | **modest win, 1.1–1.3×** at ~16k; ~tie at 1k / 262k | Op-fusion amortizes the one copy over K ops and avoids intermediate JS allocations.                                                       |

**Framing.** The consolidation goal is **dogfooding** (internal consumers exercise the
standard packages) and **reducing maintenance complexity** (one implementation, not N forks)
— _not_ making element-wise faster. WASM is a **large-input** backend that the standard
packages already own via their size-thresholded `BackendManager`: consumers get WASM at
scale and JS for small inputs, for free, without reimplementing anything. This benchmark
exists only to answer one narrow sub-question — _should element-wise transcendentals be a
WASM code path at all?_ — so we don't add a code path that doesn't earn its keep.

**Conclusion:**

- **Element-wise transcendentals (`functions`' `array_<op>_ptr` path) — inconclusive, NOT
  retired.** ⚠️ Two benchmarks of the _same_ kernel disagree, and the reason is instructive:
  `bench:elementwise` (`tools/benchmark/wasm/elementwise.bench.ts`) reports AS winning 1.4–2.5× at
  scale, but its JS baseline calls the op through an **indirect function-pointer lookup**
  (`const f = MATH_REF[op]; out[i] = f(x)`) that V8 **can't inline** — so it under-times JS by ~2.4×
  and overstates the AS win. `elementwise-wasm-single.mjs` (B8), whose JS baseline calls
  `Math.exp` **directly** (inlined), shows a **tie-to-mild-loss** (0.68–1.38× across sizes). Neither
  is the real comparison: the production JS fallback is `computePool.<op>` (ComputePool, sync for
  these ops), **not** a bare loop. So "single-op WASM loses" was an over-generalization — the honest
  status is _unproven either way_, so the path **stays** (retiring on unproven evidence risks a
  regression). Contrast the matrix element-wise **arithmetic** (add/multiply/transpose): memory-bound,
  cleanly measured 4–6× loss (`backend-audit.mjs`) — correctly retired. Transcendentals are a
  different (compute-bound) regime.
- **WASM's actual winning surface (after the 2026-07-01 retirements): SIMD matmul + the
  LU/QR/Cholesky decompositions.** The scalar element-wise-arithmetic, eig, and svd WASM paths were
  retired/removed (they lost). `tensor.matMul` dogfoods the SIMD matmul via `matrix`; `tensor`'s
  eig/svd run in **JS** (the WASM eig/svd kernels were deleted — they were 0.2–0.7× JS).
- **Maintenance/dogfooding is achieved by the consolidation, not by a WASM code path:**
  `autograd` builds on `core`'s shared `DUAL_UNARY_RULES`, `functions`/`expression` build on
  `core/internal` for number/object utils, `tensor` builds on `matrix`. One implementation each.
- **Follow-up to settle the transcendental question definitively:** benchmark
  `elementwiseUnaryDispatch(op, xs)` vs `computePool.<op>(xs)` (the _actual_ production alternative),
  not vs a bare or indirect `Math.*` loop. Until then, leave the threshold/dispatch as-is.

## `matmul-wasm.mjs` — should `Tensor.matMul` dogfood matrix's accelerated matmul?

`Tensor.matMul` (tensor/src/Tensor.ts) is a naive JS triple loop — the clearest dogfooding gap
(it should delegate to matrix's `backendManager.multiply`, which selects `WASMBackend` above
1000 elements). Measured before wiring it.

> ⚠️ **Superseded — this measured the OLD scalar kernel and drove the fix.** Adding
> `matrix_multiply_simd_ptr` (f64x2 SIMD) reversed the verdict: WASM matmul now wins **9–12×**
> (see `backend-audit.mjs` below), and `Tensor.matMul` **was** dogfooded onto it (3.6–6.8×). The
> snapshot below is the pre-SIMD "blocked upstream" state, kept for the history.

**Finding (2026-07-01, Node 24):** WASM **is** selected (`WASMBackend` for all large sizes,
binary present), yet matrix's matmul is **slower than the tight JS loop at every size**:

| size | JS     | matrix (WASM) | speedup |
| ---- | ------ | ------------- | ------- |
| 64²  | 1.3 ms | 3.2 ms        | 0.41×   |
| 128² | 9.9 ms | 21 ms         | 0.47×   |
| 256² | 109 ms | 159 ms        | 0.69×   |
| 512² | 996 ms | 1374 ms       | 0.73×   |

**Conclusion — the dogfooding target is right, but it's blocked upstream:** the AssemblyScript
matmul is a **naive scalar kernel** (no SIMD, no cache-blocking); V8's JIT of the same loop wins,
and the `DenseMatrix` + WASM copy overhead adds to it. So wiring `Tensor.matMul → matrix` today
would **regress** 0.4–0.7×. **This is the honest crux of the whole thread:** across three
measurements (element-wise single/chain, matmul) the standard packages' current WASM kernels do
**not** beat tight JS loops — there is no speedup to inherit yet. The real large-input work is
**optimizing the AS kernels (SIMD + cache-blocking)**; _then_ dogfooding `Tensor.matMul` (and the
decompositions) propagates a genuine win. Sequence: fast kernels first, dogfood second. Until
then, tensor's local loop is (correctly) the faster path.

See `project-all-libraries-build-on-core` (memory) and CHANGELOG for the full reasoning.

## `backend-audit.mjs` — JS vs WASM(SIMD) vs Parallel, per matrix op

Answers "which backend for which op." **Init WASM first** or you measure the JS fallback.

**Finding (2026-07-01, Node 24):** speedup vs the winning backend; "slower" = WASM loses.

| op                    | 128²             | 256²        | 512²        | winner          | verdict         |
| --------------------- | ---------------- | ----------- | ----------- | --------------- | --------------- |
| `multiply` (matmul)   | WASM 8.9×        | WASM 9.7×   | WASM 12×    | **WASM (SIMD)** | **keep WASM**   |
| `multiplyElementwise` | WASM 4.4× slower | 4.8× slower | 6.2× slower | Par ~1.5× / JS  | **retire WASM** |
| `add`                 | 5× slower        | 4.4× slower | 4.2× slower | Par / JS        | **retire WASM** |
| `transpose`           | 5.9× slower      | 5.7× slower | 5.1× slower | Par / JS        | **retire WASM** |

**Conclusions (implemented):**

- **SIMD, not cores, is the compute-dense lever.** WASM matmul beats _Parallel_ by 3–4× at
  every size — SIMD-WASM is the right primary accelerator; a JS worker pool can't match it for
  matmul (each worker is scalar). Parallelism is a narrow complement (async + transfer overhead;
  only ~1.5× on memory-bound element-wise via bandwidth-scaling).
- **Element-wise / transpose WASM retired.** They were 4–6× _slower_ than JS (memory-bound +
  DenseMatrix/managed-array alloc overhead) — a pure pessimization. `WASMBackend.shouldUseWasm`
  now gates WASM to `opKind: 'matmul'` only; element-wise/transpose fall to their existing JS
  path (verified ≈ JS, no longer 4–6× slower). matrix WASM+backend suites 209/209.
- **Follow-ups:** benchmark the WASM _decompositions_ (svd/eig/lu/qr/cholesky) vs JS — the scalar
  ones likely lose like scalar matmul did, so SIMD-optimize or disable per op; retire functions'
  `WASM_ELEMENTWISE_THRESHOLD` single-op path (same reason); remove the now-dead WASM element-wise
  AS kernels + `WASMBackend` bodies.

## `decomp-audit.mjs` — JS vs WASM for eig / svd (the decompositions with a wired WASM variant)

matrix exposes `eig`/`svd` (JS) **and** `eigWasm`/`svdWasm` (async WASM); **tensor dogfoods
`eigWasm`/`svdWasm`** (its `tensorEigWasm`/`tensorSvdWasm`). `lu`/`qr`/`cholesky` have JS-only public
paths — their AS kernels are built but wired to nothing (dead).

**Finding (2026-07-01, Node 24):** correct, but **WASM loses and degrades with size**:

| size | eig JS→WASM | svd JS→WASM |
| ---- | ----------- | ----------- |
| 16²  | 0.67×       | 1.20×       |
| 64²  | **0.22×**   | 0.57×       |
| 128² | **0.21×**   | 0.44×       |

**Conclusion (implemented):** the AS eig/svd kernels (Jacobi / Francis / one-sided-Jacobi) are
**scalar + async** — 0.2–0.7× JS, worst at scale (~5× slower at 128²). Unlike matmul, these are
iterative algorithms that don't vectorize into a quick SIMD win, and the scalar code has no salvage
value. **Retired:** `eig-wasm.ts`/`svd-wasm.ts` gate the WASM path behind `WASM_EIG_ENABLED` /
`WASM_SVD_ENABLED` / `WASM_SPECTRAL_ENABLED` = `false`, so `eigWasm`/`svdWasm`/`spectralRadiusWasm`
delegate to JS (this also un-pessimizes tensor's `tensorEigWasm`/`tensorSvdWasm`). The
WASM-dispatch tests are `describe.skip`/`it.skip` with the reason; matrix suite 747 pass / 20 skip.
**Net: the WASM backend's entire remaining value is the one SIMD matmul kernel.** Follow-up: delete
the dead AS decomposition kernels (`matrix_eig_*`, `matrix_svd`, `algebra/decomposition.ts` lu/qr/
cholesky) + the disabled WASM branches — a from-scratch SIMD version would be new code anyway.
_(Follow-up done 2026-07-01: the AS eig/svd kernels were deleted; lu/qr/cholesky kept — WASMBackend
uses them. See CHANGELOG.)_

## `matmul-threshold.mjs` — where does the SIMD-WASM matmul start beating JS?

Forces the WASM backend (`minElements: 0`) and compares `WASMBackend.multiply` to `jsBackend.multiply`
across small square sizes, to tune the `BackendManager` `multiply.wasm` gate. **Init WASM first.**

**Finding (2026-07-02, Node 24):** JS/WASM ratio (>1 → WASM faster):

| size | elems | JS/WASM | verdict       |
| ---- | ----- | ------- | ------------- |
| 8²   | 64    | 0.56×   | JS wins       |
| 12²  | 144   | 1.25×   | ~marginal     |
| 16²  | 256   | 1.32×   | **WASM wins** |
| 24²  | 576   | 2.27×   | WASM wins     |
| 48²  | 2304  | 4.80×   | WASM wins     |
| 128² | 16384 | 7.98×   | WASM wins     |

**Conclusion (implemented):** WASM matmul wins solidly from **256 elements (16²)**; below that the
JS↔WASM copy + alloc overhead dominates the tiny compute (8² loses, 12² marginal/noisy). Dropped the
`BackendManager` `multiply.wasm` threshold 500→256 so 16²–22² matmuls take the winning WASM path
(they were needlessly on JS). Correctness is backend-agnostic; matrix 743 pass / 7 skip.
