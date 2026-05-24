/**
 * flip — reverse element order along given axes.
 *
 * For each axis in `axes`, the index along that axis is reversed:
 *
 *   out[..., i, ...] = in[..., dim - 1 - i, ...]
 *
 * Multiple axes can be flipped in a single pass. An empty `axes` array is
 * a no-op (returns a copy of the input).
 *
 * Axis-label semantics: reversing the iteration order of an axis does not
 * change its semantic identity — it is still the same logical axis. All axis
 * labels from the input are therefore preserved unchanged in the output.
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

/**
 * Reverse element order along the specified axes.
 *
 * @param t    - Input tensor of any rank.
 * @param axes - The axes to flip. Supports negative indexing. Duplicates are
 *               ignored. An empty array returns a copy of `t`.
 * @returns A new `Tensor` with the same shape as `t`, with axis labels
 *          preserved from `t`.
 *
 * @throws {Error} If any axis value is out of range.
 *
 * @example
 * // Flip rows (axis 0) of a 3×4 matrix:
 * const flipped = flip(matrix, [0]);
 *
 * // Flip both axes simultaneously:
 * const rotated180 = flip(matrix, [0, 1]);
 */
export function flip(t: Tensor, axes: readonly number[]): Tensor {
  const rank = t.shape.length;
  const totalSize = t.shape.reduce((a, b) => a * b, 1);

  // Normalise and deduplicate axes.
  const normAxesSet = new Set<number>();
  for (const ax of axes) {
    const a = ax < 0 ? rank + ax : ax;
    if (a < 0 || a >= rank) {
      throw new Error(`flip: axis ${ax} is out of range for rank ${rank}`);
    }
    normAxesSet.add(a);
  }
  const flipSet = normAxesSet;

  const outData = new Float64Array(totalSize);
  const inStrides = Tensor.rowMajorStrides(t.shape);
  const outStrides = Tensor.rowMajorStrides(t.shape); // same shape

  // For each output index, map to the corresponding input index.
  const outIdx = new Array<number>(rank).fill(0);

  for (let flatOut = 0; flatOut < totalSize; flatOut++) {
    // Decode flatOut.
    let rem = flatOut;
    for (let k = 0; k < rank; k++) {
      outIdx[k] = Math.floor(rem / outStrides[k]);
      rem -= outIdx[k] * outStrides[k];
    }

    // For flipped axes, reverse the index.
    let flatIn = 0;
    for (let k = 0; k < rank; k++) {
      const iIdx = flipSet.has(k) ? t.shape[k] - 1 - outIdx[k] : outIdx[k];
      flatIn += iIdx * inStrides[k];
    }

    outData[flatOut] = t.data[flatIn];
  }

  // Axis labels: preserve all labels from t.
  let outLabels: ReadonlyArray<Index> | undefined;
  if (t.axisLabels !== undefined) outLabels = [...t.axisLabels];

  return new Tensor([...t.shape], outData, outLabels);
}
