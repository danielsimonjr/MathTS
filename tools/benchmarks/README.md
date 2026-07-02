# Benchmarks

Standalone reproducible micro-benchmarks (not a workspace member). Run with a plain
`node tools/benchmarks/<file>.mjs` from the repo root (needs `npm run build:wasm` first so
`assembly/build/mathts.wasm` exists).

## `elementwise-wasm-single.mjs` / `elementwise-wasm-chain.mjs` — the B8 acceleration spike

**Question (B8):** does routing tensor/autograd element-wise ops through the WASM batch
kernels (`array_exp` etc.) beat V8's JIT of a `Math.*` loop? Measured before building, so we
don't ship an assumed win.

**Finding (2026-07-01, Node 24, this machine):**

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

- **Element-wise transcendentals are the one op-class where even large-input WASM does not
  help** (0.85–0.95× single-op; scalar AS math ≤ V8 libm, plus the copy). So they correctly
  stay JS — and `DUAL_UNARY_RULES`' `primal` functions stay `Math.*`. Chain-fusion wins only
  modestly and doesn't fit `autograd` (each op must also compute the tangent, which the
  primal-only kernels don't — the fusion breaks).
- **Where large-input WASM _does_ win — the O(n²⁺) ops (SVD / eig / matmul / FFT) — the
  dogfooding is already in place:** `tensor` routes its decompositions through `matrix`, whose
  `BackendManager` engages WASM above threshold. So `tensor` inherits large-input WASM for the
  ops that benefit, with zero duplicated kernels.
- **Maintenance/dogfooding is achieved by the consolidation, not by a WASM code path:**
  `autograd` builds on `core`'s shared `DUAL_UNARY_RULES`, `functions`/`expression` build on
  `core/internal` for number/object utils, `tensor` builds on `matrix`. One implementation
  each; large-input WASM handled by the standard packages.
- **Follow-up:** `functions`' `WASM_ELEMENTWISE_THRESHOLD = 1024` _single-op_ path looks like a
  mild pessimization (single-op WASM never wins); verify against its actual dispatch incl. the
  parallel/worker path before changing. The _chain_ dispatch is fine.

## `matmul-wasm.mjs` — should `Tensor.matMul` dogfood matrix's accelerated matmul?

`Tensor.matMul` (tensor/src/Tensor.ts) is a naive JS triple loop — the clearest dogfooding gap
(it should delegate to matrix's `backendManager.multiply`, which selects `WASMBackend` above
1000 elements). Measured before wiring it.

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
