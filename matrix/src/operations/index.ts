/**
 * Matrix Operations
 *
 * Exports all matrix decomposition and computation operations.
 */

// Eigenvalue decomposition
export { eig, eigvals, powerIteration, type EigResult, type EigOptions } from './eig.js';

// Singular Value Decomposition
export {
  svd,
  singularValues,
  pinv,
  lowRankApprox,
  cond,
  norm2,
  normFro,
  type SVDResult,
  type SVDOptions,
} from './svd.js';

// WASM-accelerated eigendecomposition
export { eigWasm, eigvalsWasm, spectralRadiusWasm } from './eig-wasm.js';

// WASM-accelerated SVD
export { svdWasm } from './svd-wasm.js';

// QR decomposition (DenseMatrix primitive — Gram-Schmidt with re-orthogonalisation)
export { qr, type QRResult, type QROptions } from './qr.js';

// LU decomposition (DenseMatrix primitive — Doolittle with partial pivoting)
export { lu, type LUResult } from './lu.js';

// Cholesky decomposition (DenseMatrix primitive — right-looking algorithm)
export { cholesky, type CholeskyResult } from './cholesky.js';
