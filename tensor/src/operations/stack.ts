/**
 * stack — stack same-shape tensors along a new axis (NumPy `stack`).
 *
 * All input tensors must have identical shapes. A new axis is inserted at
 * position `axis` in the output, making the output rank = input rank + 1.
 * `stack([a, b], 0)` is equivalent to NumPy's `np.stack([a, b], axis=0)`.
 *
 * Axis-label semantics:
 *   - The new axis gets `undefined` label by default (it has no correspondence
 *     to any input axis).
 *   - Pass `opts.newAxisLabel` (an `Index`) to label the new axis explicitly.
 *   - The remaining axes inherit labels from `tensors[0]`. If labels disagree
 *     across inputs for a given axis, `tensors[0]`'s label is used silently
 *     (no error, no warning — document this choice here).
 *   - If `tensors[0]` has no `axisLabels`, the output also carries none.
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

export interface StackOpts {
  /**
   * Optional label for the newly created axis. If omitted, the new axis
   * carries no label (`axisLabels[axis] === undefined` in the output, or more
   * precisely: the output `axisLabels` array contains `undefined` at that
   * position — encoded as `null` in the array but TypeScript sees it as the
   * slot being absent when axisLabels is stripped to only defined entries).
   *
   * In practice: if `tensors[0].axisLabels` is defined, an `Index` for the
   * new axis is created either from this option or as a placeholder.
   */
  newAxisLabel?: Index;
}

/**
 * Stack same-shape tensors along a new axis.
 *
 * @param tensors - Array of tensors, all with the same shape. Must be non-empty.
 * @param axis    - Position of the new axis in the output. Supports negative
 *                  indexing relative to the output rank. E.g. `axis=0` inserts
 *                  a new leading axis; `axis=-1` appends a new trailing axis.
 * @param opts    - Optional `newAxisLabel` for the inserted axis.
 * @returns A tensor of rank `inputRank + 1` with `shape[axis] === tensors.length`.
 *
 * @throws {Error} If `tensors` is empty, or if any tensor's shape differs from
 *                 `tensors[0]`.
 *
 * @example
 * // Stack two row-vectors [a, b, c] and [d, e, f] → 2×3 matrix:
 * const matrix = stack([v1, v2], 0);
 */
export function stack(tensors: Tensor[], axis: number, opts?: StackOpts): Tensor {
  if (tensors.length === 0) {
    throw new Error('stack: tensors array must be non-empty');
  }

  const first = tensors[0];
  const inRank = first.shape.length;
  const outRank = inRank + 1;

  // Normalise axis relative to output rank.
  const ax = axis < 0 ? outRank + axis : axis;
  if (ax < 0 || ax > inRank) {
    throw new Error(`stack: axis ${axis} is out of range for output rank ${outRank}`);
  }

  // Validate all tensors have the same shape.
  for (let t = 1; t < tensors.length; t++) {
    const s = tensors[t].shape;
    if (s.length !== inRank) {
      throw new Error(
        `stack: tensors[${t}] has rank ${s.length} but tensors[0] has rank ${inRank}`
      );
    }
    for (let k = 0; k < inRank; k++) {
      if (s[k] !== first.shape[k]) {
        throw new Error(
          `stack: shape mismatch at axis ${k}: tensors[${t}].shape[${k}]=${s[k]} ` +
            `vs tensors[0].shape[${k}]=${first.shape[k]}`
        );
      }
    }
  }

  // Build output shape: insert tensors.length at position ax.
  const outShape: number[] = [];
  for (let k = 0; k < ax; k++) outShape.push(first.shape[k]);
  outShape.push(tensors.length);
  for (let k = ax; k < inRank; k++) outShape.push(first.shape[k]);

  const outSize = outShape.reduce((a, b) => a * b, 1);
  const outData = new Float64Array(outSize);

  const outStrides = Tensor.rowMajorStrides(outShape);
  const inStrides = Tensor.rowMajorStrides(first.shape);

  // Fill output: iterate over each input tensor.
  for (let ti = 0; ti < tensors.length; ti++) {
    const inData = tensors[ti].data;
    const inSize = first.shape.reduce((a, b) => a * b, 1);
    const inIdx = new Array<number>(inRank).fill(0);

    for (let flatIn = 0; flatIn < inSize; flatIn++) {
      // Decode flatIn into inIdx.
      let rem = flatIn;
      for (let k = 0; k < inRank; k++) {
        inIdx[k] = Math.floor(rem / inStrides[k]);
        rem -= inIdx[k] * inStrides[k];
      }

      // Build output flat index: insert ti at position ax.
      let flatOut = 0;
      for (let k = 0; k < ax; k++) flatOut += inIdx[k] * outStrides[k];
      flatOut += ti * outStrides[ax];
      for (let k = ax; k < inRank; k++) flatOut += inIdx[k] * outStrides[k + 1];

      outData[flatOut] = inData[flatIn];
    }
  }

  // Axis labels.
  let outLabels: ReadonlyArray<Index> | undefined;
  if (first.axisLabels !== undefined) {
    // Build the new axis label.
    const newLabel: Index = opts?.newAxisLabel ?? new Index(tensors.length, { name: undefined });

    const labels: Index[] = [];
    for (let k = 0; k < ax; k++) labels.push(first.axisLabels[k]);
    labels.push(newLabel);
    for (let k = ax; k < inRank; k++) labels.push(first.axisLabels[k]);
    outLabels = labels;
  } else if (opts?.newAxisLabel !== undefined) {
    // Input has no labels but caller provided a label for the new axis.
    // In this case we cannot fill the other slots, so we omit axisLabels.
    // (The caller can add labels later via Tensor construction.)
  }

  return new Tensor(outShape, outData, outLabels);
}
