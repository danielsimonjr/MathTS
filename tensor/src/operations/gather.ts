/**
 * gather — pull elements along one axis (NumPy `take` / JAX `gather`).
 *
 * For each index in `indices`, the output contains the corresponding "slice"
 * of the input tensor along `axis`. The output has the same rank as the input;
 * only `shape[axis]` changes to `indices.length`.
 *
 * Axis-label semantics: the gathered axis's label is **primed** (primeLevel
 * incremented by 1 via `Index.prime()`) so it does not auto-match the original
 * axis in `contract`. All other axis labels are preserved unchanged.
 *
 * The priming approach mirrors ITensors.jl's convention: after gathering, the
 * index is the "selected" variant of the original, not the original itself.
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

/**
 * Gather elements along `axis` using `indices`.
 *
 * @param t       - Input tensor of any rank.
 * @param axis    - The axis along which to gather. Supports negative indexing.
 * @param indices - The indices to gather. Duplicates are allowed.
 * @returns A new `Tensor` with `shape[axis] === indices.length` and all other
 *          dimensions unchanged. The gathered-axis label is primed.
 *
 * @throws {RangeError} If any index in `indices` is outside [0, shape[axis]).
 * @throws {Error}      If `axis` is out of range.
 *
 * @example
 * // Select rows 0 and 2 from a 3×4 matrix:
 * const rows = gather(matrix, 0, [0, 2]);   // shape [2, 4]
 */
export function gather(t: Tensor, axis: number, indices: readonly number[]): Tensor {
  const rank = t.shape.length;

  // Normalise negative axis.
  const ax = axis < 0 ? rank + axis : axis;
  if (ax < 0 || ax >= rank) {
    throw new Error(`gather: axis ${axis} is out of range for rank ${rank}`);
  }

  const dimAx = t.shape[ax];

  // Validate indices.
  for (let i = 0; i < indices.length; i++) {
    if (!Number.isInteger(indices[i]) || indices[i] < 0 || indices[i] >= dimAx) {
      throw new RangeError(
        `gather: index ${indices[i]} at position ${i} is out of range [0, ${dimAx}) for axis ${ax}`
      );
    }
  }

  // Output shape.
  const outShape = [...t.shape];
  outShape[ax] = indices.length;

  const outSize = outShape.reduce((a, b) => a * b, 1);
  const outData = new Float64Array(outSize);

  if (outSize > 0) {
    const inStrides = Tensor.rowMajorStrides(t.shape);
    const outStrides = Tensor.rowMajorStrides(outShape);

    const outIdx = new Array<number>(rank).fill(0);
    for (let flatOut = 0; flatOut < outSize; flatOut++) {
      // Decode flatOut into outIdx.
      let rem = flatOut;
      for (let k = 0; k < rank; k++) {
        outIdx[k] = Math.floor(rem / outStrides[k]);
        rem -= outIdx[k] * outStrides[k];
      }

      // Map gathered axis: outIdx[ax] → indices[outIdx[ax]].
      let flatIn = 0;
      for (let k = 0; k < rank; k++) {
        const inK = k === ax ? indices[outIdx[k]] : outIdx[k];
        flatIn += inK * inStrides[k];
      }

      outData[flatOut] = t.data[flatIn];
    }
  }

  // Axis labels: preserve all labels; prime the gathered axis.
  let outLabels: ReadonlyArray<Index> | undefined;
  if (t.axisLabels !== undefined) {
    outLabels = t.axisLabels.map((lbl, k) => {
      if (k === ax) {
        // Prime the gathered axis via Index.prime(). This increments primeLevel
        // while keeping the same id, so the primed index will NOT auto-match
        // the original in Tensor.contract (which requires id AND primeLevel to
        // agree). The Index.dim field is not changed by .prime() — it reflects
        // the original dimension. That is intentional: the actual axis size is
        // tracked by Tensor.shape; axisLabels carry identity/tagging, not a
        // second source of truth for dimension.
        return lbl.prime();
      }
      return lbl;
    });
  }

  return new Tensor(outShape, outData, outLabels);
}
