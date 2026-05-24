export { Tensor } from './Tensor';
export type { NestedArray, EinsumSpec } from './Tensor';

// ITensor-parity additions (see docs/roadmap/ITENSOR_PARITY.md)
//   Phase 1: named-Index value type + Tensor.contract / replaceIndex / axisOf
//   Phase 2: tensorSvd — truncated tensor SVD layered on the matrix SVD
//   Phase 3: randomTensor — uniform / normal / orthogonal random constructors
export { Index, idx } from './named-index';
export type { IndexOpts } from './named-index';
export { tensorSvd } from './operations/svd';
export type { TensorSvdOpts, TensorSvdResult } from './operations/svd';
export { randomTensor } from './operations/random';
export type { RandomTensorOpts } from './operations/random';

// Phase 4: optimal pairwise-contraction order over a tensor network.
export { contractNetwork } from './contraction-sequence';
export type { ContractNetworkOpts, ContractNetworkResult } from './contraction-sequence';
