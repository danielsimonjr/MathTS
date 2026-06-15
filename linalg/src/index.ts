/**
 * @danielsimonjr/mathts-linalg
 *
 * Standalone linear-algebra decompositions for MathTS. Re-exports the matrix
 * decomposition / factorization operations from
 * {@link @danielsimonjr/mathts-matrix} -- eigen, SVD, QR, LU, Cholesky, Schur,
 * pseudo-inverse, and matrix functions (expm/logm/sqrtm) -- as a focused
 * package. The implementation lives in matrix; this is an entry point, not a copy.
 *
 * @packageDocumentation
 */

export {
  // Eigenvalue decomposition
  eig,
  eigvals,
  powerIteration,

  // Singular Value Decomposition
  svd,
  singularValues,
  pinv,
  lowRankApprox,
  cond,
  norm2,
  normFro,

  // WASM-accelerated variants
  eigWasm,
  eigvalsWasm,
  spectralRadiusWasm,
  svdWasm,

  // DenseMatrix primitives
  matrixPinv,
  qr,
  lu,
  cholesky,

  // Matrix functions
  matrixExpm,
  matrixLogm,
  matrixSqrtm,
  matrixSchur,
} from '@danielsimonjr/mathts-matrix';

export type {
  EigResult,
  EigOptions,
  SVDResult,
  SVDOptions,
  PinvOptions,
  QRResult,
  QROptions,
  LUResult,
  CholeskyResult,
  ExpmOptions,
  LogmOptions,
  SqrtmOptions,
  SchurResult,
  SchurOptions,
} from '@danielsimonjr/mathts-matrix';
