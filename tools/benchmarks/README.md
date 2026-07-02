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

See `project-all-libraries-build-on-core` (memory) and CHANGELOG for the full reasoning.
