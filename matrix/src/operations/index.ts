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

// Moore-Penrose pseudoinverse (DenseMatrix primitive — Slice 4.2)
// Re-exported as `matrixPinv` to avoid collision with `pinv` from svd.js above.
export { pinv as matrixPinv, type PinvOptions } from './pinv.js';

// QR decomposition (DenseMatrix primitive — Gram-Schmidt with re-orthogonalisation)
export { qr, type QRResult, type QROptions } from './qr.js';

// LU decomposition (DenseMatrix primitive — Doolittle with partial pivoting)
export { lu, type LUResult } from './lu.js';

// Cholesky decomposition (DenseMatrix primitive — right-looking algorithm)
export { cholesky, type CholeskyResult } from './cholesky.js';

// Matrix exponential (DenseMatrix primitive — Padé-13 scaling-and-squaring, Slice 5.9)
export { matrixExpm, type ExpmOptions } from './expm.js';

// Matrix logarithm (DenseMatrix primitive — inverse scaling-and-squaring, Slice 5.9a)
export { matrixLogm, type LogmOptions } from './logm.js';

// Matrix square root (DenseMatrix primitive — Schur-Björck-Hammarling, Slices 5.9a + 6.1)
export { matrixSqrtm, type SqrtmOptions } from './sqrtm.js';

// Schur decomposition primitive (Slice 6.1)
export { matrixSchur, type SchurResult, type SchurOptions } from './schur.js';
