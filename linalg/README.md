# @danielsimonjr/mathts-linalg

Standalone linear-algebra decompositions for [MathTS](https://github.com/danielsimonjr/mathts).

A focused entry point over the decomposition operations in
[`@danielsimonjr/mathts-matrix`](https://www.npmjs.com/package/@danielsimonjr/mathts-matrix).
The implementation is re-exported, not duplicated.

## Install

```sh
npm install @danielsimonjr/mathts-linalg
```

## What it exports

- **Eigen:** `eig`, `eigvals`, `powerIteration` (+ async `eigWasm`, `eigvalsWasm`, `spectralRadiusWasm`, which now delegate to JS — the WASM eig kernels were retired 2026-07 as a scalar pessimization).
- **SVD:** `svd`, `singularValues`, `pinv`, `lowRankApprox`, `cond`, `norm2`, `normFro` (+ async `svdWasm`, which delegates to JS — the WASM SVD kernel was retired 2026-07).
- **Factorizations:** `qr`, `lq`, `rq`, `ql`, `qrPivoted`, `lu`, `cholesky`, `matrixSchur`, `matrixPinv`.

`svd`, `lu`, `qr`, `lq`, `rq`, `ql`, `qrPivoted`, `cholesky`, `eig`, `powerIteration`, and `matrixSchur` (and their `*Wasm` delegates) accept `DenseMatrix`, nested `number[][]`, a square row-major `Float64Array`, or `{ data: Float64Array, rows, cols }`. `matrixPinv` and `condest` stay `DenseMatrix`. A packed descriptor is not an LU result: objects with `L`, `U`, `p`, or `P` are not read as packed storage. Unknown, ragged, and non-square `Float64Array` inputs throw `TypeError`. A length-0 `Float64Array` is the 0×0 matrix. `lu`, `cholesky`, and `matrixSchur` still require a square matrix.

- **Matrix functions:** `matrixExpm`, `matrixLogm`, `matrixSqrtm`.
- Result/option types: `EigResult`, `SVDResult`, `QRResult`, `LUResult`, `CholeskyResult`, `SchurResult`, etc.

Extra factorizations on `@danielsimonjr/mathts-matrix` (`luSolve`, `qrPivoted`, `lq`,
`ql`, `rq`, `condest`, …) are intentionally **not** re-exported here.

## License

MIT (c) Daniel Simon Jr.
