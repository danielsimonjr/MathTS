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

**Conclusion — element-wise WASM is _not_ the propagation win it looked like:**

- **Do not** route single element-wise ops through WASM — it regresses. (This also means
  `functions`' `WASM_ELEMENTWISE_THRESHOLD = 1024` single-op path is a mild pessimization
  worth revisiting — see TODO; the _chain_ dispatch is fine.)
- Chain-fusion wins only modestly, only for K ≥ 2 at mid sizes, and needs a lazy/deferred
  execution model to exploit. Crucially it **does not fit `autograd`**: each op must also
  compute the tangent (derivative), which the primal-only WASM kernels don't — the fusion
  breaks.
- The real WASM wins remain the O(n²⁺) ops (SVD / eig / matmul / FFT) where compute
  dominates the copy — already accelerated in `matrix`.

So the `DUAL_UNARY_RULES` `primal` functions correctly stay JS `Math.*`; there is no faster
scalar-transcendental path to propagate. See `project-all-libraries-build-on-core` (memory)
and CHANGELOG for the reasoning.
