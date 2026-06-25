# WASM Accelerator ↔ Function Pairing

**Generated**: 2026-06-25 (by tools/create-dependency-graph)

Per public `mathTyped` function in `functions/src/typed/`, its acceleration routing: **wasm** (a `*Dispatch` bridge), **parallel** (worker pool via `computePool`/`shouldParallelize`), or **js-only**. WASM engages for `Float64Array` inputs above threshold; dispatch order is Rust → AS → JS.

> Detection is per-`mathTyped`-block direct references; routing reached only via helper functions outside the block is not traced, so this can under-report.

| Routing (static) | Count |
| --- | --: |
| WASM (incl. wasm+parallel) | 39 |
| Parallel only (worker pool) | 52 |
| JS-only | 127 |
| **Total** | **218** |

**Runtime effectiveness** (probe of the bundled `functions/dist/wasm/mathts.wasm`, backend: **rust**): of the 39 wasm-routed functions, **18 actually execute wasm**, **21 fall back to JS** (their dispatch bridge needs the AssemblyScript `__new` allocator, absent from a Rust-only module — the dispatch's allocate throws and is caught → JS).

## WASM-accelerated functions

| Function | Routing | Effective | Bridge dispatch | Module |
| --- | --- | --- | --- | --- |
| `abs` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | arithmetic |
| `airyAi` | wasm | js-fallback | `airyAiDispatch` | special |
| `airyBi` | wasm | js-fallback | `airyBiDispatch` | special |
| `atan` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | trigonometry |
| `atanh` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | trigonometry |
| `besselJ` | wasm | js-fallback | `besselJDispatch` | special |
| `besselJ0` | wasm | js-fallback | `besselJ0Dispatch` | special |
| `besselJ1` | wasm | js-fallback | `besselJ1Dispatch` | special |
| `besselY` | wasm | js-fallback | `besselYDispatch` | special |
| `besselY0` | wasm | js-fallback | `besselY0Dispatch` | special |
| `besselY1` | wasm | js-fallback | `besselY1Dispatch` | special |
| `carlsonRC` | wasm | js-fallback | `carlsonRCDispatch` | special |
| `carlsonRD` | wasm | js-fallback | `carlsonRDDispatch` | special |
| `carlsonRF` | wasm | js-fallback | `carlsonRFDispatch` | special |
| `carlsonRJ` | wasm | js-fallback | `carlsonRJDispatch` | special |
| `cos` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | trigonometry |
| `cot` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | trigonometry |
| `csc` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | trigonometry |
| `ellipticE` | wasm | js-fallback | `ellipticEDispatch` | special |
| `ellipticEIncomplete` | wasm | js-fallback | `ellipticEIncompleteDispatch` | special |
| `ellipticF` | wasm | js-fallback | `ellipticFIncompleteDispatch` | special |
| `ellipticK` | wasm | js-fallback | `ellipticKDispatch` | special |
| `ellipticPi` | wasm | js-fallback | `ellipticPiIncompleteDispatch` | special |
| `erfc` | wasm | wasm | `elementwiseUnaryDispatch` | special |
| `exp` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | arithmetic |
| `expm1` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | arithmetic |
| `lgamma` | wasm | js-fallback | `lgammaDispatch` | special |
| `log` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | arithmetic |
| `log10` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | arithmetic |
| `log1p` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | arithmetic |
| `log2` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | arithmetic |
| `noncentralChi2PDF` | wasm | js-fallback | `lgammaDispatch` | distributions |
| `parallelStatMedian` | wasm | js-fallback | `sortF64Dispatch` | statistics |
| `parallelStatQuantile` | wasm | js-fallback | `sortF64Dispatch` | statistics |
| `sec` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | trigonometry |
| `sin` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | trigonometry |
| `sinh` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | arithmetic |
| `tan` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | trigonometry |
| `tanh` | wasm+parallel | wasm | `elementwiseUnaryDispatch` | arithmetic |

## Parallel-only functions (worker pool, not WASM)

| Function | Module |
| --- | --- |
| `acos` | trigonometry |
| `acosh` | trigonometry |
| `add` | arithmetic |
| `asin` | trigonometry |
| `asinh` | trigonometry |
| `bitAnd` | bitwise |
| `bitNot` | bitwise |
| `bitOr` | bitwise |
| `bitXor` | bitwise |
| `cbrt` | arithmetic |
| `ceil` | arithmetic |
| `cosh` | arithmetic |
| `cube` | arithmetic |
| `divide` | arithmetic |
| `dot` | arithmetic |
| `fix` | arithmetic |
| `floor` | arithmetic |
| `leftShift` | bitwise |
| `max` | arithmetic |
| `mean` | arithmetic |
| `min` | arithmetic |
| `multiply` | arithmetic |
| `norm` | arithmetic |
| `parallelConv` | signal |
| `parallelFFT` | signal |
| `parallelFFTMagnitude` | signal |
| `parallelFFTPower` | signal |
| `parallelIFFT` | signal |
| `parallelStatCorr` | statistics |
| `parallelStatDistance` | statistics |
| `parallelStatHistogram` | statistics |
| `parallelStatMAD` | statistics |
| `parallelStatMax` | statistics |
| `parallelStatMean` | statistics |
| `parallelStatMin` | statistics |
| `parallelStatMinMax` | statistics |
| `parallelStatNorm` | statistics |
| `parallelStatProd` | statistics |
| `parallelStatStd` | statistics |
| `parallelStatSum` | statistics |
| `parallelStatVariance` | statistics |
| `rightArithShift` | bitwise |
| `rightLogShift` | bitwise |
| `round` | arithmetic |
| `sign` | arithmetic |
| `sqrt` | arithmetic |
| `square` | arithmetic |
| `std` | arithmetic |
| `subtract` | arithmetic |
| `sum` | arithmetic |
| `unaryMinus` | arithmetic |
| `variance` | arithmetic |

## Per-module counts

| Module | WASM | Parallel | JS-only |
| --- | --: | --: | --: |
| arithmetic | 9 | 23 | 13 |
| bitwise | 0 | 7 | 0 |
| combinatorics | 0 | 0 | 21 |
| complex | 0 | 0 | 4 |
| distributions | 1 | 0 | 13 |
| logical | 0 | 0 | 5 |
| matrix-ops | 0 | 0 | 9 |
| probability | 0 | 0 | 8 |
| relational | 0 | 0 | 7 |
| set | 0 | 0 | 10 |
| signal | 0 | 5 | 2 |
| special | 19 | 0 | 19 |
| statistics | 2 | 13 | 2 |
| string | 0 | 0 | 5 |
| trigonometry | 8 | 4 | 7 |
| unit | 0 | 0 | 2 |

> Notes: matrix linear-algebra ops are WASM-accelerated separately via the `matrix` package backend (not the typed-API dispatch counted here). The elementwise transcendentals (abs/sin/cos/tan/exp/log) are the wasm-effective set — benchmarked 1.35–5.1× over JS incl. copy. The js-fallback functions (bessel/airy/elliptic/…) were benchmarked too: per-op wasm is break-even-to-slower for them, so the JS fallback is not a regression. Reductions/binary-arithmetic stay JS by the same measure. See docs/roadmap/WASM_PAIRING_GAP_PLAN.md and the `bench:elementwise`/`bench:special-array` benches.
