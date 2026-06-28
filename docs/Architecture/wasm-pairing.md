# WASM Accelerator ↔ Function Pairing

**Generated**: 2026-06-28 (by tools/create-dependency-graph)

Per public `mathTyped` function in `functions/src/typed/`, its acceleration routing: **wasm** (a `*Dispatch` bridge), **parallel** (worker pool via `computePool`/`shouldParallelize`), or **js-only**. WASM engages for `Float64Array` inputs above threshold; the functions dispatch is AS → JS.

> Detection is per-`mathTyped`-block direct references; routing reached only via helper functions outside the block is not traced, so this can under-report.

| Routing (static) | Count |
| --- | --: |
| WASM (incl. wasm+parallel) | 39 |
| Parallel only (worker pool) | 52 |
| JS-only | 127 |
| **Total** | **218** |

**Runtime effectiveness** (probe of the bundled `functions/dist/wasm/mathts-as.wasm`, backend: **unknown**): of the 39 wasm-routed functions, **0 actually execute wasm**, **0 fall back to JS** (their `*Dispatch` has no AS-managed execution path — the poly-fit / Airy / argsort+rank kernels are deliberately kept on JS pending AS kernel-stabilization fixes).

## WASM-accelerated functions

| Function | Routing | Effective | Bridge dispatch | Module |
| --- | --- | --- | --- | --- |
| `abs` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | arithmetic |
| `airyAi` | wasm | unknown | `airyAiDispatch` | special |
| `airyBi` | wasm | unknown | `airyBiDispatch` | special |
| `atan` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | trigonometry |
| `atanh` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | trigonometry |
| `besselJ` | wasm | unknown | `besselJDispatch` | special |
| `besselJ0` | wasm | unknown | `besselJ0Dispatch` | special |
| `besselJ1` | wasm | unknown | `besselJ1Dispatch` | special |
| `besselY` | wasm | unknown | `besselYDispatch` | special |
| `besselY0` | wasm | unknown | `besselY0Dispatch` | special |
| `besselY1` | wasm | unknown | `besselY1Dispatch` | special |
| `carlsonRC` | wasm | unknown | `carlsonRCDispatch` | special |
| `carlsonRD` | wasm | unknown | `carlsonRDDispatch` | special |
| `carlsonRF` | wasm | unknown | `carlsonRFDispatch` | special |
| `carlsonRJ` | wasm | unknown | `carlsonRJDispatch` | special |
| `cos` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | trigonometry |
| `cot` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | trigonometry |
| `csc` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | trigonometry |
| `ellipticE` | wasm | unknown | `ellipticEDispatch` | special |
| `ellipticEIncomplete` | wasm | unknown | `ellipticEIncompleteDispatch` | special |
| `ellipticF` | wasm | unknown | `ellipticFIncompleteDispatch` | special |
| `ellipticK` | wasm | unknown | `ellipticKDispatch` | special |
| `ellipticPi` | wasm | unknown | `ellipticPiIncompleteDispatch` | special |
| `erfc` | wasm | unknown | `elementwiseUnaryDispatch` | special |
| `exp` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | arithmetic |
| `expm1` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | arithmetic |
| `lgamma` | wasm | unknown | `lgammaDispatch` | special |
| `log` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | arithmetic |
| `log10` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | arithmetic |
| `log1p` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | arithmetic |
| `log2` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | arithmetic |
| `noncentralChi2PDF` | wasm | unknown | `lgammaDispatch` | distributions |
| `parallelStatMedian` | wasm | unknown | `sortF64Dispatch` | statistics |
| `parallelStatQuantile` | wasm | unknown | `sortF64Dispatch` | statistics |
| `sec` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | trigonometry |
| `sin` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | trigonometry |
| `sinh` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | arithmetic |
| `tan` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | trigonometry |
| `tanh` | wasm+parallel | unknown | `elementwiseUnaryDispatch` | arithmetic |

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

> Notes: matrix linear-algebra ops are WASM-accelerated separately via the `matrix` package backend (not the typed-API dispatch counted here), which runs the AssemblyScript binary for fft/eig/svd/decomposition. The elementwise transcendentals (abs/sin/cos/tan/exp/log) plus the AS special/poly/sort/signal/interp kernels are the wasm-effective set. The js-fallback functions (poly fits, Airy, argsort/rank) are on JS because their AS kernels are broken or unstable — tracked follow-ups.
