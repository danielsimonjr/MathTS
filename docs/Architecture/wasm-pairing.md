# WASM Accelerator ↔ Function Pairing

**Generated**: 2026-07-02 (by tools/create-dependency-graph)

Per public `mathTyped` function in `functions/src/typed/`, its acceleration routing: **wasm** (a `*Dispatch` bridge), **parallel** (worker pool via `computePool`/`shouldParallelize`), or **js-only**. WASM engages for `Float64Array` inputs above threshold; the functions dispatch is AS → JS.

> Detection is per-`mathTyped`-block direct references; routing reached only via helper functions outside the block is not traced, so this can under-report.

| Routing (static)            |   Count |
| --------------------------- | ------: |
| WASM (incl. wasm+parallel)  |      39 |
| Parallel only (worker pool) |      52 |
| JS-only                     |     127 |
| **Total**                   | **218** |

**Runtime effectiveness** (probe of the bundled `functions/dist/wasm/mathts-as.wasm`, backend: **assemblyscript**): of the 39 wasm-routed functions, **39 actually execute wasm**, **0 fall back to JS** (their `*Dispatch` has no AS-managed execution path — the poly-fit / Airy / argsort+rank kernels are deliberately kept on JS pending AS kernel-stabilization fixes).

## WASM-accelerated functions

| Function               | Routing       | Effective | Bridge dispatch                | Module        |
| ---------------------- | ------------- | --------- | ------------------------------ | ------------- |
| `abs`                  | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | arithmetic    |
| `airyAi`               | wasm          | wasm      | `airyAiDispatch`               | special       |
| `airyBi`               | wasm          | wasm      | `airyBiDispatch`               | special       |
| `atan`                 | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | trigonometry  |
| `atanh`                | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | trigonometry  |
| `besselJ`              | wasm          | wasm      | `besselJDispatch`              | special       |
| `besselJ0`             | wasm          | wasm      | `besselJ0Dispatch`             | special       |
| `besselJ1`             | wasm          | wasm      | `besselJ1Dispatch`             | special       |
| `besselY`              | wasm          | wasm      | `besselYDispatch`              | special       |
| `besselY0`             | wasm          | wasm      | `besselY0Dispatch`             | special       |
| `besselY1`             | wasm          | wasm      | `besselY1Dispatch`             | special       |
| `carlsonRC`            | wasm          | wasm      | `carlsonRCDispatch`            | special       |
| `carlsonRD`            | wasm          | wasm      | `carlsonRDDispatch`            | special       |
| `carlsonRF`            | wasm          | wasm      | `carlsonRFDispatch`            | special       |
| `carlsonRJ`            | wasm          | wasm      | `carlsonRJDispatch`            | special       |
| `cos`                  | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | trigonometry  |
| `cot`                  | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | trigonometry  |
| `csc`                  | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | trigonometry  |
| `ellipticE`            | wasm          | wasm      | `ellipticEDispatch`            | special       |
| `ellipticEIncomplete`  | wasm          | wasm      | `ellipticEIncompleteDispatch`  | special       |
| `ellipticF`            | wasm          | wasm      | `ellipticFIncompleteDispatch`  | special       |
| `ellipticK`            | wasm          | wasm      | `ellipticKDispatch`            | special       |
| `ellipticPi`           | wasm          | wasm      | `ellipticPiIncompleteDispatch` | special       |
| `erfc`                 | wasm          | wasm      | `elementwiseUnaryDispatch`     | special       |
| `exp`                  | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | arithmetic    |
| `expm1`                | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | arithmetic    |
| `lgamma`               | wasm          | wasm      | `lgammaDispatch`               | special       |
| `log`                  | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | arithmetic    |
| `log10`                | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | arithmetic    |
| `log1p`                | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | arithmetic    |
| `log2`                 | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | arithmetic    |
| `noncentralChi2PDF`    | wasm          | wasm      | `lgammaDispatch`               | distributions |
| `parallelStatMedian`   | wasm          | wasm      | `sortF64Dispatch`              | statistics    |
| `parallelStatQuantile` | wasm          | wasm      | `sortF64Dispatch`              | statistics    |
| `sec`                  | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | trigonometry  |
| `sin`                  | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | trigonometry  |
| `sinh`                 | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | arithmetic    |
| `tan`                  | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | trigonometry  |
| `tanh`                 | wasm+parallel | wasm      | `elementwiseUnaryDispatch`     | arithmetic    |

## Parallel-only functions (worker pool, not WASM)

| Function                | Module       |
| ----------------------- | ------------ |
| `acos`                  | trigonometry |
| `acosh`                 | trigonometry |
| `add`                   | arithmetic   |
| `asin`                  | trigonometry |
| `asinh`                 | trigonometry |
| `bitAnd`                | bitwise      |
| `bitNot`                | bitwise      |
| `bitOr`                 | bitwise      |
| `bitXor`                | bitwise      |
| `cbrt`                  | arithmetic   |
| `ceil`                  | arithmetic   |
| `cosh`                  | arithmetic   |
| `cube`                  | arithmetic   |
| `divide`                | arithmetic   |
| `dot`                   | arithmetic   |
| `fix`                   | arithmetic   |
| `floor`                 | arithmetic   |
| `leftShift`             | bitwise      |
| `max`                   | arithmetic   |
| `mean`                  | arithmetic   |
| `min`                   | arithmetic   |
| `multiply`              | arithmetic   |
| `norm`                  | arithmetic   |
| `parallelConv`          | signal       |
| `parallelFFT`           | signal       |
| `parallelFFTMagnitude`  | signal       |
| `parallelFFTPower`      | signal       |
| `parallelIFFT`          | signal       |
| `parallelStatCorr`      | statistics   |
| `parallelStatDistance`  | statistics   |
| `parallelStatHistogram` | statistics   |
| `parallelStatMAD`       | statistics   |
| `parallelStatMax`       | statistics   |
| `parallelStatMean`      | statistics   |
| `parallelStatMin`       | statistics   |
| `parallelStatMinMax`    | statistics   |
| `parallelStatNorm`      | statistics   |
| `parallelStatProd`      | statistics   |
| `parallelStatStd`       | statistics   |
| `parallelStatSum`       | statistics   |
| `parallelStatVariance`  | statistics   |
| `rightArithShift`       | bitwise      |
| `rightLogShift`         | bitwise      |
| `round`                 | arithmetic   |
| `sign`                  | arithmetic   |
| `sqrt`                  | arithmetic   |
| `square`                | arithmetic   |
| `std`                   | arithmetic   |
| `subtract`              | arithmetic   |
| `sum`                   | arithmetic   |
| `unaryMinus`            | arithmetic   |
| `variance`              | arithmetic   |

## Per-module counts

| Module        | WASM | Parallel | JS-only |
| ------------- | ---: | -------: | ------: |
| arithmetic    |    9 |       23 |      13 |
| bitwise       |    0 |        7 |       0 |
| combinatorics |    0 |        0 |      21 |
| complex       |    0 |        0 |       4 |
| distributions |    1 |        0 |      13 |
| logical       |    0 |        0 |       5 |
| matrix-ops    |    0 |        0 |       9 |
| probability   |    0 |        0 |       8 |
| relational    |    0 |        0 |       7 |
| set           |    0 |        0 |      10 |
| signal        |    0 |        5 |       2 |
| special       |   19 |        0 |      19 |
| statistics    |    2 |       13 |       2 |
| string        |    0 |        0 |       5 |
| trigonometry  |    8 |        4 |       7 |
| unit          |    0 |        0 |       2 |

> Notes: matrix linear-algebra ops are WASM-accelerated separately via the `matrix` package backend (not the typed-API dispatch counted here), which runs the AssemblyScript binary for fft/eig/svd/decomposition. The elementwise transcendentals (abs/sin/cos/tan/exp/log) plus the AS special/poly/sort/signal/interp kernels are the wasm-effective set. The js-fallback functions (poly fits, Airy, argsort/rank) are on JS because their AS kernels are broken or unstable — tracked follow-ups.

## WASM binary exports

Probed from `assembly/build/mathts.wasm` via `WebAssembly.Module.exports()` (a parse-only static read — no instantiation; rebuild with `npm run build:wasm`).

**326 total exports** = **314 functions** + **11 globals** (numeric constants such as `PI`/`E`) + **1 memory** (the shared linear memory), compiled from **28 AssemblyScript source files** under `assembly/src/`.

| Category (by export-name prefix) | Function exports |
| -------------------------------- | ---------------: |
| Scalar & special (f64)           |              133 |
| Array                            |               54 |
| Matrix                           |               46 |
| Complex scalar                   |               46 |
| Complex array                    |               33 |
| FFT                              |                2 |
| **Total**                        |          **314** |
