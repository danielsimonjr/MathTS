/**
 * Matrix type definitions
 */

import type { BackendType } from '@mathts/core';

/**
 * Anything that can be converted to a matrix
 */
export type MatrixLike = number[][] | Float64Array | Float32Array;

/**
 * Matrix creation options
 */
export interface MatrixOptions {
  /** Preferred computation backend */
  backend?: BackendType;
  /** Numeric type for storage */
  dtype?: 'float32' | 'float64';
}

/**
 * Matrix storage format
 */
export type StorageFormat = 'dense' | 'csr' | 'csc' | 'coo';
