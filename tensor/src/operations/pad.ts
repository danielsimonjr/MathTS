/**
 * pad — pad each axis by [before, after] amounts.
 *
 * Three modes are supported, mirroring NumPy's `np.pad`:
 *
 * - `'constant'` (default): Fill padded cells with `constantValue` (default 0).
 * - `'edge'`:    Repeat the boundary element along each padded slice.
 * - `'reflect'`: Mirror the data across the boundary, excluding the boundary
 *                element itself. Requires that each padding amount is strictly
 *                less than the corresponding axis size.
 *
 * Axis-label semantics: output rank equals input rank and axis identities do
 * not change (padding is just extension, not transformation). All axis labels
 * from the input are preserved unchanged in the output.
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

export interface PadOptions {
  /**
   * Padding mode.
   * - `'constant'` (default): fill with `constantValue`.
   * - `'edge'`:    repeat boundary element.
   * - `'reflect'`: mirror across boundary, excluding boundary itself.
   */
  mode?: 'constant' | 'edge' | 'reflect';
  /** Value used when `mode === 'constant'`. Default `0`. */
  constantValue?: number;
}

/**
 * Pad a tensor along each axis by specified widths.
 *
 * @param t         - Input tensor of any rank.
 * @param padWidths - Array of `[before, after]` pairs, one per axis. Length
 *                    must equal `t.shape.length`. Each value must be >= 0.
 * @param opts      - Optional padding options (mode and constantValue).
 * @returns A new `Tensor` with `shape[k] = t.shape[k] + before_k + after_k`
 *          and axis labels preserved from `t`.
 *
 * @throws {Error}      If `padWidths.length !== t.shape.length`, any pad
 *                      value is negative, or `mode === 'reflect'` is used
 *                      with a pad amount >= the corresponding axis size.
 *
 * @example
 * // Constant-pad a 3×4 tensor with 1 cell of zeros on each side:
 * const padded = pad(t, [[1, 1], [1, 1]]);  // shape [5, 6]
 *
 * // Edge-pad with asymmetric widths:
 * const ep = pad(t, [[2, 0], [0, 1]], { mode: 'edge' });
 */
export function pad(
  t: Tensor,
  padWidths: readonly (readonly [number, number])[],
  opts?: PadOptions
): Tensor {
  const rank = t.shape.length;
  const mode = opts?.mode ?? 'constant';
  const fillValue = opts?.constantValue ?? 0;

  // Validate padWidths.
  if (padWidths.length !== rank) {
    throw new Error(`pad: padWidths length ${padWidths.length} does not match tensor rank ${rank}`);
  }
  for (let k = 0; k < rank; k++) {
    const [before, after] = padWidths[k];
    if (!Number.isInteger(before) || before < 0) {
      throw new Error(`pad: padWidths[${k}][0] must be a non-negative integer, got ${before}`);
    }
    if (!Number.isInteger(after) || after < 0) {
      throw new Error(`pad: padWidths[${k}][1] must be a non-negative integer, got ${after}`);
    }
    if (mode === 'reflect') {
      const dim = t.shape[k];
      if (before >= dim || after >= dim) {
        throw new Error(
          `pad: reflect mode requires pad amounts < axis size; ` +
            `axis ${k} has size ${dim} but pad is [${before}, ${after}]`
        );
      }
    }
  }

  // Compute output shape.
  const outShape = t.shape.map((d, k) => d + padWidths[k][0] + padWidths[k][1]);
  const outSize = outShape.reduce((a, b) => a * b, 1);
  const outData = new Float64Array(outSize);

  if (mode === 'constant') {
    // Fill entire output with constantValue (Float64Array is 0-filled by default).
    if (fillValue !== 0) outData.fill(fillValue);
  }

  const inStrides = Tensor.rowMajorStrides(t.shape);
  const outStrides = Tensor.rowMajorStrides(outShape);

  // For each output position, compute the corresponding input value.
  const outIdx = new Array<number>(rank).fill(0);

  for (let flatOut = 0; flatOut < outSize; flatOut++) {
    // Decode flatOut into outIdx.
    let rem = flatOut;
    for (let k = 0; k < rank; k++) {
      outIdx[k] = Math.floor(rem / outStrides[k]);
      rem -= outIdx[k] * outStrides[k];
    }

    // Map each output axis index to an input axis index.
    let inBounds = true;
    let flatIn = 0;

    for (let k = 0; k < rank; k++) {
      const before = padWidths[k][0];
      const dim = t.shape[k];
      const oIdx = outIdx[k];

      let iIdx: number;

      if (oIdx < before) {
        // In the "before" pad region.
        if (mode === 'constant') {
          inBounds = false;
          break;
        } else if (mode === 'edge') {
          iIdx = 0;
        } else {
          // reflect: mirror distance from boundary (offset from 0 in input coords)
          // oIdx is in [0, before), map to (before - oIdx) in input coords.
          iIdx = before - oIdx; // = 1, 2, ..., before
        }
      } else if (oIdx >= before + dim) {
        // In the "after" pad region.
        if (mode === 'constant') {
          inBounds = false;
          break;
        } else if (mode === 'edge') {
          iIdx = dim - 1;
        } else {
          // reflect: distance past the last element (0-based from end of input)
          // oIdx - (before + dim) = 0, 1, 2, ...  → reflect to dim-2, dim-3, ...
          const dist = oIdx - (before + dim - 1); // 1, 2, ...
          iIdx = dim - 1 - dist;
        }
      } else {
        // Interior: direct mapping.
        iIdx = oIdx - before;
      }

      flatIn += iIdx * inStrides[k];
    }

    if (inBounds) {
      outData[flatOut] = t.data[flatIn];
    }
    // For constant mode, out-of-bounds cells already have fillValue.
  }

  // Axis labels: preserve all labels from t (output rank == input rank).
  let outLabels: ReadonlyArray<Index> | undefined;
  if (t.axisLabels !== undefined) {
    outLabels = [...t.axisLabels];
  }

  return new Tensor(outShape, outData, outLabels);
}
