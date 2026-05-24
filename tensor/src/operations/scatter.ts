/**
 * scatter — inverse of gather. Writes `updates` into a copy of `t` at the
 * given `indices` along `axis` (NumPy `np.put_along_axis` / JAX `scatter`).
 *
 * For each position `i` in `indices`, the corresponding "slice" of `updates`
 * along `axis` is written into the matching "slice" of the output at position
 * `indices[i]`. All positions of `t` not referenced by `indices` are copied
 * unchanged.
 *
 * Duplicate-index semantics: **last-wins** — when the same index appears more
 * than once in `indices`, the last occurrence overwrites earlier ones. This
 * mirrors NumPy's default scatter behaviour. Document-level note: if
 * deterministic accumulation (e.g. `add`) is needed, use `ScatterOpts.reduce`.
 *
 * Axis-label semantics: the output has exactly the same shape as `t`
 * (scatter never changes the size of any axis), so all axis labels from `t`
 * are preserved unchanged.
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

export interface ScatterOpts {
  /**
   * How to combine `updates` with existing values at the target positions.
   * - `'overwrite'` (default) — last-wins; target is replaced.
   * - `'add'`                 — target is incremented by the update value.
   */
  reduce?: 'overwrite' | 'add';
}

/**
 * Scatter `updates` into a copy of `t` at `indices` along `axis`.
 *
 * @param t       - Destination tensor (not mutated). Any rank.
 * @param axis    - The axis along which to scatter. Supports negative indexing.
 * @param indices - Target positions along `axis`. Must all be in
 *                  `[0, t.shape[axis])`. Duplicates are allowed (last-wins
 *                  by default, or add-accumulate when `opts.reduce === 'add'`).
 * @param updates - Source tensor. Must have the same rank as `t` with
 *                  `updates.shape[axis] === indices.length` and all other
 *                  dimensions equal to `t.shape`.
 * @param opts    - Optional scatter options.
 * @returns A new `Tensor` with the same shape as `t`, with axis labels
 *          preserved from `t`.
 *
 * @throws {Error}      If `axis` is out of range, `updates` rank mismatches,
 *                      or `updates` shape is incompatible.
 * @throws {RangeError} If any index in `indices` is outside `[0, shape[axis])`.
 *
 * @example
 * // Round-trip with gather: scatter zeros back to a masked copy
 * const zeros = new Tensor([3, 4], new Float64Array(12));
 * const result = scatter(zeros, 0, [0, 2], gather(t, 0, [0, 2]));
 * // result[0, :] === t[0, :], result[1, :] === 0, result[2, :] === t[2, :]
 */
export function scatter(
  t: Tensor,
  axis: number,
  indices: readonly number[],
  updates: Tensor,
  opts?: ScatterOpts
): Tensor {
  const rank = t.shape.length;
  const reduce = opts?.reduce ?? 'overwrite';

  // Normalise axis.
  const ax = axis < 0 ? rank + axis : axis;
  if (ax < 0 || ax >= rank) {
    throw new Error(`scatter: axis ${axis} is out of range for rank ${rank}`);
  }

  const dimAx = t.shape[ax];

  // Validate indices.
  for (let i = 0; i < indices.length; i++) {
    if (!Number.isInteger(indices[i]) || indices[i] < 0 || indices[i] >= dimAx) {
      throw new RangeError(
        `scatter: index ${indices[i]} at position ${i} is out of range [0, ${dimAx}) for axis ${ax}`
      );
    }
  }

  // Validate updates shape.
  if (updates.shape.length !== rank) {
    throw new Error(
      `scatter: updates rank ${updates.shape.length} does not match tensor rank ${rank}`
    );
  }
  for (let k = 0; k < rank; k++) {
    if (k === ax) {
      if (updates.shape[k] !== indices.length) {
        throw new Error(
          `scatter: updates.shape[${k}] = ${updates.shape[k]} but indices.length = ${indices.length}`
        );
      }
    } else {
      if (updates.shape[k] !== t.shape[k]) {
        throw new Error(
          `scatter: updates.shape[${k}] = ${updates.shape[k]} does not match t.shape[${k}] = ${t.shape[k]}`
        );
      }
    }
  }

  // Copy input data into output.
  const outData = new Float64Array(t.data);

  if (indices.length > 0) {
    const inStrides = Tensor.rowMajorStrides(t.shape);
    const updStrides = Tensor.rowMajorStrides(updates.shape);
    const updSize = updates.shape.reduce((a, b) => a * b, 1);

    // Iterate over all positions in updates.
    const updIdx = new Array<number>(rank).fill(0);
    for (let flatUpd = 0; flatUpd < updSize; flatUpd++) {
      // Decode flatUpd into updIdx.
      let rem = flatUpd;
      for (let k = 0; k < rank; k++) {
        updIdx[k] = Math.floor(rem / updStrides[k]);
        rem -= updIdx[k] * updStrides[k];
      }

      // Map updates axis index → target index in t.
      const targetAxIdx = indices[updIdx[ax]];

      // Compute flat output index.
      let flatOut = 0;
      for (let k = 0; k < rank; k++) {
        const idxK = k === ax ? targetAxIdx : updIdx[k];
        flatOut += idxK * inStrides[k];
      }

      if (reduce === 'add') {
        outData[flatOut] += updates.data[flatUpd];
      } else {
        outData[flatOut] = updates.data[flatUpd];
      }
    }
  }

  // Axis labels: preserve all labels from t (output shape == t.shape).
  let outLabels: ReadonlyArray<Index> | undefined;
  if (t.axisLabels !== undefined) {
    outLabels = [...t.axisLabels];
  }

  return new Tensor([...t.shape], outData, outLabels);
}
