/**
 * concatenate — join tensors along an existing axis (NumPy `concatenate`).
 *
 * All tensors must agree on every axis except the join axis. The output rank
 * equals the input rank; only `shape[axis]` grows (sum of all input shapes
 * along that axis).
 *
 * Axis-label semantics:
 *   - All axis labels are taken from `tensors[0]`.
 *   - If any `tensors[i].axisLabels[axis]` disagrees with `tensors[0]`'s label
 *     on the join axis, `tensors[0]`'s label is used silently (matching the
 *     principle that the first tensor is authoritative for label semantics).
 *   - If `tensors[0]` carries no `axisLabels`, the output also carries none.
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

/**
 * Concatenate tensors along an existing `axis`.
 *
 * @param tensors - Array of tensors. Must be non-empty. All must agree on every
 *                  axis except `axis`.
 * @param axis    - The axis along which to concatenate. Supports negative indexing.
 * @returns A tensor with the same rank and with `shape[axis]` equal to the sum
 *          of `tensors[i].shape[axis]`.
 *
 * @throws {Error} If `tensors` is empty, if any tensor has a different rank, or
 *                 if shapes disagree on any non-join axis.
 *
 * @example
 * // Vertically stack two 2×3 matrices → 4×3 matrix:
 * const tall = concatenate([a, b], 0);
 * // Horizontally stack two 2×3 matrices → 2×6 matrix:
 * const wide = concatenate([a, b], 1);
 */
export function concatenate(tensors: Tensor[], axis: number): Tensor {
  if (tensors.length === 0) {
    throw new Error('concatenate: tensors array must be non-empty');
  }

  const first = tensors[0];
  const rank = first.shape.length;

  // Normalise axis.
  const ax = axis < 0 ? rank + axis : axis;
  if (ax < 0 || ax >= rank) {
    throw new Error(`concatenate: axis ${axis} is out of range for rank ${rank}`);
  }

  // Validate shape compatibility.
  for (let t = 1; t < tensors.length; t++) {
    const s = tensors[t].shape;
    if (s.length !== rank) {
      throw new Error(
        `concatenate: tensors[${t}] has rank ${s.length} but tensors[0] has rank ${rank}`
      );
    }
    for (let k = 0; k < rank; k++) {
      if (k !== ax && s[k] !== first.shape[k]) {
        throw new Error(
          `concatenate: shape mismatch on non-join axis ${k}: ` +
            `tensors[${t}].shape[${k}]=${s[k]} vs tensors[0].shape[${k}]=${first.shape[k]}`
        );
      }
    }
  }

  // Output shape: sum the join axis across all tensors.
  const joinDim = tensors.reduce((sum, t) => sum + t.shape[ax], 0);
  const outShape = [...first.shape];
  outShape[ax] = joinDim;

  const outSize = outShape.reduce((a, b) => a * b, 1);
  const outData = new Float64Array(outSize);

  const outStrides = Tensor.rowMajorStrides(outShape);

  // Fill output: for each input tensor, copy its elements with the appropriate
  // offset along the join axis.
  let joinOffset = 0;
  for (let ti = 0; ti < tensors.length; ti++) {
    const t = tensors[ti];
    const inShape = t.shape;
    const inSize = inShape.reduce((a, b) => a * b, 1);
    const inStrides = Tensor.rowMajorStrides(inShape);
    const inIdx = new Array<number>(rank).fill(0);

    for (let flatIn = 0; flatIn < inSize; flatIn++) {
      // Decode flatIn into inIdx.
      let rem = flatIn;
      for (let k = 0; k < rank; k++) {
        inIdx[k] = Math.floor(rem / inStrides[k]);
        rem -= inIdx[k] * inStrides[k];
      }

      // Map to output flat index: join axis shifts by joinOffset.
      let flatOut = 0;
      for (let k = 0; k < rank; k++) {
        const outK = k === ax ? inIdx[k] + joinOffset : inIdx[k];
        flatOut += outK * outStrides[k];
      }

      outData[flatOut] = t.data[flatIn];
    }

    joinOffset += inShape[ax];
  }

  // Axis labels: use tensors[0]'s labels; update join-axis label's dim.
  let outLabels: ReadonlyArray<Index> | undefined;
  if (first.axisLabels !== undefined) {
    outLabels = first.axisLabels.map((lbl, k) => {
      if (k === ax) {
        // Rebuild the join-axis label with updated dimension.
        return new Index(joinDim, { name: lbl.name, tags: [...lbl.tags] });
      }
      return lbl;
    });
  }

  return new Tensor(outShape, outData, outLabels);
}
