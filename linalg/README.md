# @danielsimonjr/mathts-linalg

Standalone linear-algebra decompositions for [MathTS](https://github.com/danielsimonjr/mathts).

A focused entry point over the decomposition operations in
[`@danielsimonjr/mathts-matrix`](https://www.npmjs.com/package/@danielsimonjr/mathts-matrix).
The implementation is re-exported, not duplicated.

## Install

```sh
npm install @danielsimonjr/mathts-matrix @danielsimonjr/mathts-linalg
```

`DenseMatrix` lives in `mathts-matrix`. This package re-exports factorizations only.

## Example

```ts
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { lu, svd, eig } from '@danielsimonjr/mathts-linalg';

const A = DenseMatrix.fromArray([
  [1, 2],
  [3, 4],
]);

const { L, U } = lu(A);
const { U: uSvd, S } = svd(A);
const { eigenvalues } = eig(A.toArray());

console.log(L.get(0, 0), U.get(1, 1), S[0], eigenvalues[0]);
```

Nested `number[][]` also work for `lu`, `svd`, `eig`, and the other dense routines documented below.

## What it exports

- **Eigen:** `eig`, `eigvals`, `powerIteration` (+ async `eigWasm`, `eigvalsWasm`, `spectralRadiusWasm`, which now delegate to JS — the WASM eig kernels were retired 2026-07 as a scalar pessimization).
- **SVD:** `svd`, `singularValues`, `pinv`, `lowRankApprox`, `cond`, `norm2`, `normFro` (+ async `svdWasm`, which delegates to JS — the WASM SVD kernel was retired 2026-07).
- **Factorizations:** `qr`, `lq`, `rq`, `ql`, `qrPivoted`, `lu`, `cholesky`, `matrixSchur`, `matrixPinv`, `luSolve`, `condest`.

`svd`, `lu`, `qr`, `lq`, `rq`, `ql`, `qrPivoted`, `cholesky`, `eig`, `powerIteration`, and `matrixSchur` (and their `*Wasm` delegates) accept `DenseMatrix`, nested `number[][]`, a square row-major `Float64Array`, or `{ data: Float64Array, rows, cols }`. `matrixPinv` and `condest` stay `DenseMatrix`. A packed descriptor is not an LU result: objects with `L`, `U`, `p`, or `P` are not read as packed storage. Unknown, ragged, and non-square `Float64Array` inputs throw `TypeError`. A length-0 `Float64Array` is the 0×0 matrix. `lu`, `cholesky`, and `matrixSchur` still require a square matrix.

- **Matrix functions:** `matrixExpm`, `matrixLogm`, `matrixSqrtm`.
- Result/option types: `EigResult`, `SVDResult`, `QRResult`, `LUResult`, `CholeskyResult`, `SchurResult`, etc.

## License

MIT (c) Daniel Simon Jr.
