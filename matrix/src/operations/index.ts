/**
 * Matrix Operations
 *
 * Exports all matrix decomposition and computation operations.
 */

// Eigenvalue decomposition
export {
  eig,
  eigvals,
  powerIteration,
  type EigResult,
  type EigOptions,
} from './eig.js';

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
export {
  eigWasm,
  eigvalsWasm,
  spectralRadiusWasm,
} from './eig-wasm.js';

// WASM-accelerated SVD
export { svdWasm } from './svd-wasm.js';
