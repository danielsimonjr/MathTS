/**
 * @mathts/matrix - High-performance matrix operations
 * @packageDocumentation
 */

export { Matrix } from './matrix';
export { DenseMatrix } from './dense-matrix';
export { SparseMatrix } from './sparse-matrix';
export type { MatrixLike, MatrixOptions } from './types';

// Backend exports
export { backends, type Backend } from './backends';

// Version
export const VERSION = '0.1.0';
