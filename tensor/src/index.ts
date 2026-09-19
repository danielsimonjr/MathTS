export { Tensor } from './Tensor.js';
export type { NestedArray, EinsumSpec } from './Tensor.js';

// ITensor-parity additions (see docs/roadmap/ITENSOR_PARITY.md)
//   Phase 1: named-Index value type + Tensor.contract / replaceIndex / axisOf
//   Phase 2: tensorSvd — truncated tensor SVD layered on the matrix SVD
//   Phase 3: randomTensor — uniform / normal / orthogonal random constructors
export { Index, idx } from './named-index.js';
export type { IndexOpts } from './named-index.js';
export { tensorSvd, tensorSvdWasm } from './operations/svd.js';
export type { TensorSvdOpts, TensorSvdResult } from './operations/svd.js';
export { randomTensor } from './operations/random.js';
export type { RandomTensorOpts } from './operations/random.js';

// Phase 4: optimal pairwise-contraction order over a tensor network.
export { contractNetwork } from './contraction-sequence.js';
export type { ContractNetworkOpts, ContractNetworkResult } from './contraction-sequence.js';

// Slice 3: tensor decomposition wrappers (QR / LU / Cholesky / Eig)
export { tensorQr } from './operations/qr.js';
export type { TensorQrOpts, TensorQrResult } from './operations/qr.js';
export { tensorLU } from './operations/lu.js';
export type { TensorLUOpts, TensorLUResult } from './operations/lu.js';
export { tensorCholesky } from './operations/cholesky.js';
export type { TensorCholeskyOpts, TensorCholeskyResult } from './operations/cholesky.js';
export { tensorEig, tensorEigWasm } from './operations/eig.js';
export type { TensorEigOpts, TensorEigResult } from './operations/eig.js';

// Slice 2.4: tensorPinv + tensorSolve + tensorKron
export { tensorPinv } from './operations/pinv.js';
export type { TensorPinvOpts } from './operations/pinv.js';
export { tensorSolve } from './operations/solve.js';
export type { TensorSolveOpts, TensorSolveResult } from './operations/solve.js';
export { tensorKron } from './operations/kron.js';
export type { TensorKronOpts } from './operations/kron.js';

// Slice 4.7: indexing primitives — slice, gather, stack, concatenate
export { slice } from './operations/slice.js';
export type { SliceRange } from './operations/slice.js';
export { gather } from './operations/gather.js';
export { stack } from './operations/stack.js';
export type { StackOpts } from './operations/stack.js';
export { concatenate } from './operations/concatenate.js';

// Slice 5.1 (4.7b): scatter, pad, roll, flip
export { scatter } from './operations/scatter.js';
export type { ScatterOpts } from './operations/scatter.js';
export { pad } from './operations/pad.js';
export type { PadOptions } from './operations/pad.js';
export { roll } from './operations/roll.js';
export { flip } from './operations/flip.js';
