# WASM Accelerator ↔ Function Pairing

**Generated**: 2026-06-25 (by tools/create-dependency-graph)

Public `mathTyped` functions in `functions/src/typed/` and whether each routes to a WASM bridge (`*Dispatch`) or runs pure-JS. WASM engages only for `Float64Array` inputs at/above `WASM_SPECIAL_THRESHOLD` (1024); dispatch order is Rust → AssemblyScript → JS fallback.

| | Count |
| --- | --: |
| Total public typed functions | 218 |
| WASM-accelerated | 21 |
| JS-only | 197 |

## WASM-accelerated functions

| Function | Bridge dispatch | Module |
| --- | --- | --- |
| `airyAi` | `airyAiDispatch` | special |
| `airyBi` | `airyBiDispatch` | special |
| `besselJ` | `besselJDispatch` | special |
| `besselJ0` | `besselJ0Dispatch` | special |
| `besselJ1` | `besselJ1Dispatch` | special |
| `besselY` | `besselYDispatch` | special |
| `besselY0` | `besselY0Dispatch` | special |
| `besselY1` | `besselY1Dispatch` | special |
| `carlsonRC` | `carlsonRCDispatch` | special |
| `carlsonRD` | `carlsonRDDispatch` | special |
| `carlsonRF` | `carlsonRFDispatch` | special |
| `carlsonRJ` | `carlsonRJDispatch` | special |
| `ellipticE` | `ellipticEDispatch` | special |
| `ellipticEIncomplete` | `ellipticEIncompleteDispatch` | special |
| `ellipticF` | `ellipticFIncompleteDispatch` | special |
| `ellipticK` | `ellipticKDispatch` | special |
| `ellipticPi` | `ellipticPiIncompleteDispatch` | special |
| `lgamma` | `lgammaDispatch` | special |
| `noncentralChi2PDF` | `lgammaDispatch` | distributions |
| `parallelStatMedian` | `sortF64Dispatch` | statistics |
| `parallelStatQuantile` | `sortF64Dispatch` | statistics |

## Per-module counts

| Module | Accelerated | JS-only |
| --- | --: | --: |
| arithmetic | 0 | 45 |
| bitwise | 0 | 7 |
| combinatorics | 0 | 21 |
| complex | 0 | 4 |
| distributions | 1 | 13 |
| logical | 0 | 5 |
| matrix-ops | 0 | 9 |
| probability | 0 | 8 |
| relational | 0 | 7 |
| set | 0 | 10 |
| signal | 0 | 7 |
| special | 18 | 20 |
| statistics | 2 | 15 |
| string | 0 | 5 |
| trigonometry | 0 | 19 |
| unit | 0 | 2 |

> Note: matrix linear-algebra ops are WASM-accelerated separately via the `matrix` package backend (not the typed-API dispatch counted here), and internal poly/signal/sort/interpolation kernels accelerate algebra/numeric paths.
