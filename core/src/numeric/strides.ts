/**
 * Row-major stride vectors for dense tensor layouts.
 */

/**
 * Row-major strides for a shape array: the last axis has stride 1, and each
 * earlier stride is the product of all later axis sizes.
 *
 * @param shape - Tensor dimensions (any rank, including rank 0).
 * @returns Stride per axis in the same order as `shape`.
 *
 * @example
 * ```ts
 * rowMajorStrides([2, 3, 4]); // [12, 4, 1]
 * rowMajorStrides([]); // []
 * ```
 */
export function rowMajorStrides(shape: readonly number[]): number[] {
  const strides = new Array<number>(shape.length);
  let acc = 1;
  for (let k = shape.length - 1; k >= 0; k--) {
    strides[k] = acc;
    acc *= shape[k];
  }
  return strides;
}
