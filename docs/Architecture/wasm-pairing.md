# WASM Accelerator ↔ Function Pairing

**Generated**: 2026-06-25 (by tools/create-dependency-graph)

Per public `mathTyped` function in `functions/src/typed/`, its acceleration routing: **wasm** (a `*Dispatch` bridge), **parallel** (worker pool via `computePool`/`shouldParallelize`), or **js-only**. WASM engages for `Float64Array` inputs above threshold; dispatch order is Rust → AS → JS.

> Detection is per-`mathTyped`-block direct references; routing reached only via helper functions outside the block is not traced, so this can under-report.

| Routing | Count |
| --- | --: |
| WASM (incl. wasm+parallel) | 27 |
| Parallel only (worker pool) | 63 |
| JS-only | 128 |
| **Total** | **218** |

## WASM-accelerated functions

| Function | Routing | Bridge dispatch | Module |
| --- | --- | --- | --- |
| `abs` | wasm+parallel | `elementwiseUnaryDispatch` | arithmetic |
| `airyAi` | wasm | `airyAiDispatch` | special |
| `airyBi` | wasm | `airyBiDispatch` | special |
| `besselJ` | wasm | `besselJDispatch` | special |
| `besselJ0` | wasm | `besselJ0Dispatch` | special |
| `besselJ1` | wasm | `besselJ1Dispatch` | special |
| `besselY` | wasm | `besselYDispatch` | special |
| `besselY0` | wasm | `besselY0Dispatch` | special |
| `besselY1` | wasm | `besselY1Dispatch` | special |
| `carlsonRC` | wasm | `carlsonRCDispatch` | special |
| `carlsonRD` | wasm | `carlsonRDDispatch` | special |
| `carlsonRF` | wasm | `carlsonRFDispatch` | special |
| `carlsonRJ` | wasm | `carlsonRJDispatch` | special |
| `cos` | wasm+parallel | `elementwiseUnaryDispatch` | trigonometry |
| `ellipticE` | wasm | `ellipticEDispatch` | special |
| `ellipticEIncomplete` | wasm | `ellipticEIncompleteDispatch` | special |
| `ellipticF` | wasm | `ellipticFIncompleteDispatch` | special |
| `ellipticK` | wasm | `ellipticKDispatch` | special |
| `ellipticPi` | wasm | `ellipticPiIncompleteDispatch` | special |
| `exp` | wasm+parallel | `elementwiseUnaryDispatch` | arithmetic |
| `lgamma` | wasm | `lgammaDispatch` | special |
| `log` | wasm+parallel | `elementwiseUnaryDispatch` | arithmetic |
| `noncentralChi2PDF` | wasm | `lgammaDispatch` | distributions |
| `parallelStatMedian` | wasm | `sortF64Dispatch` | statistics |
| `parallelStatQuantile` | wasm | `sortF64Dispatch` | statistics |
| `sin` | wasm+parallel | `elementwiseUnaryDispatch` | trigonometry |
| `tan` | wasm+parallel | `elementwiseUnaryDispatch` | trigonometry |

## Parallel-only functions (worker pool, not WASM)

| Function | Module |
| --- | --- |
| `acos` | trigonometry |
| `acosh` | trigonometry |
| `add` | arithmetic |
| `asin` | trigonometry |
| `asinh` | trigonometry |
| `atan` | trigonometry |
| `atanh` | trigonometry |
| `bitAnd` | bitwise |
| `bitNot` | bitwise |
| `bitOr` | bitwise |
| `bitXor` | bitwise |
| `cbrt` | arithmetic |
| `ceil` | arithmetic |
| `cosh` | arithmetic |
| `cot` | trigonometry |
| `csc` | trigonometry |
| `cube` | arithmetic |
| `divide` | arithmetic |
| `dot` | arithmetic |
| `expm1` | arithmetic |
| `fix` | arithmetic |
| `floor` | arithmetic |
| `leftShift` | bitwise |
| `log10` | arithmetic |
| `log1p` | arithmetic |
| `log2` | arithmetic |
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
| `sec` | trigonometry |
| `sign` | arithmetic |
| `sinh` | arithmetic |
| `sqrt` | arithmetic |
| `square` | arithmetic |
| `std` | arithmetic |
| `subtract` | arithmetic |
| `sum` | arithmetic |
| `tanh` | arithmetic |
| `unaryMinus` | arithmetic |
| `variance` | arithmetic |

## Per-module counts

| Module | WASM | Parallel | JS-only |
| --- | --: | --: | --: |
| arithmetic | 3 | 29 | 13 |
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
| special | 18 | 0 | 20 |
| statistics | 2 | 13 | 2 |
| string | 0 | 0 | 5 |
| trigonometry | 3 | 9 | 7 |
| unit | 0 | 0 | 2 |

> Notes: matrix linear-algebra ops are WASM-accelerated separately via the `matrix` package backend (not the typed-API dispatch counted here). Per-op WASM for elementwise/reduction kernels was benchmarked and is *slower* than the JS/parallel paths once the JS→wasm copy is included (see docs/roadmap/WASM_PAIRING_GAP_PLAN.md); parallel-only routing is therefore intentional, not a gap.
