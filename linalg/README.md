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
- **SVD:** `svd`, `singularValues`, `pinv`, `lowRankApprox`, `cond`, `norm2`, `normFro` (+ `svdWasm`).
- **Factorizations:** `qr`, `lu`, `cholesky`, `matrixSchur`, `matrixPinv`.
- **Matrix functions:** `matrixExpm`, `matrixLogm`, `matrixSqrtm`.
- Result/option types: `EigResult`, `SVDResult`, `QRResult`, `LUResult`, `CholeskyResult`, `SchurResult`, etc.

## License

MIT (c) Daniel Simon Jr.
