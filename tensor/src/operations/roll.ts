/**
 * roll — cyclic shift along given axes.
 *
 * Each element is moved `shifts[k]` positions forward along `axes[k]`
 * (wrapping around at the axis boundaries). Negative shifts move backward.
 *
 * When `axes` is omitted, `shifts` must be a single number and the tensor is
 * treated as a flattened 1-D array that is shifted by that amount, then
 * reshaped back to the original shape — exactly matching NumPy `np.roll(t, n)`.
 *
 * Implementation: for each output flat index, the corresponding input flat
 * index is computed by decoding the multi-index, un-shifting each specified
 * axis (with modulo wrap), then re-encoding to a flat input index.
 *
 * Axis-label semantics: cyclic shifting does not change the semantic identity
 * of any axis (it is the same axis with reordered elements), so all axis
 * labels from the input are preserved unchanged in the output.
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

/**
 * Cyclically shift a tensor along given axes.
 *
 * @param t      - Input tensor of any rank.
 * @param shifts - Number of positions to shift. A single number when `axes` is
 *                 omitted (flat shift); an array of the same length as `axes`
 *                 when `axes` is provided.
 * @param axes   - Axes to shift along. Supports negative indexing. When
 *                 omitted, the tensor is treated as flattened and `shifts` must
 *                 be a single number.
 * @returns A new `Tensor` with the same shape as `t`, with axis labels
 *          preserved from `t`.
 *
 * @throws {Error} If `axes` is provided and `shifts` array length !== `axes`
 *                 length, or if any axis value is out of range.
 *
 * @example
 * // Shift a rank-1 tensor [1,2,3,4,5] by 2: → [4,5,1,2,3]
 * const r = roll(t, 2, [0]);
 *
 * // Flat shift (no axes):
 * const flat = roll(matrix, 3);
 */
export function roll(
  t: Tensor,
  shifts: number | readonly number[],
  axes?: readonly number[]
): Tensor {
  const rank = t.shape.length;
  const totalSize = t.shape.reduce((a, b) => a * b, 1);

  // ---- Flat-shift mode (axes omitted) ----
  if (axes === undefined) {
    if (Array.isArray(shifts)) {
      throw new Error('roll: when axes is omitted, shifts must be a single number');
    }
    const shift = shifts as number;
    const outData = new Float64Array(totalSize);
    // outFlat[i] = inFlat[(i - shift + n * totalSize) % totalSize]
    const n = totalSize;
    for (let i = 0; i < n; i++) {
      const srcIdx = (((i - shift) % n) + n) % n;
      outData[i] = t.data[srcIdx];
    }
    let outLabels: ReadonlyArray<Index> | undefined;
    if (t.axisLabels !== undefined) outLabels = [...t.axisLabels];
    return new Tensor([...t.shape], outData, outLabels);
  }

  // ---- Per-axis mode ----
  // Normalise shifts to an array.
  const shiftArr: number[] = Array.isArray(shifts)
    ? [...(shifts as readonly number[])]
    : [shifts as number];

  if (shiftArr.length !== axes.length) {
    throw new Error(
      `roll: shifts length ${shiftArr.length} does not match axes length ${axes.length}`
    );
  }

  // Normalise axes (allow negatives, deduplicate modulo).
  const normAxes: number[] = axes.map((ax) => {
    const a = ax < 0 ? rank + ax : ax;
    if (a < 0 || a >= rank) {
      throw new Error(`roll: axis ${ax} is out of range for rank ${rank}`);
    }
    return a;
  });

  // Build a per-axis shift map (last specification wins for duplicate axes).
  const axisShift = new Array<number>(rank).fill(0);
  for (let i = 0; i < normAxes.length; i++) {
    axisShift[normAxes[i]] = shiftArr[i];
  }

  const outData = new Float64Array(totalSize);
  const inStrides = Tensor.rowMajorStrides(t.shape);
  const outStrides = Tensor.rowMajorStrides(t.shape); // same shape

  // For each output position, compute the source position.
  // outIdx[k] = srcIdx[k] + axisShift[k]  (with wrap)
  // => srcIdx[k] = (outIdx[k] - axisShift[k] + dim_k * large) % dim_k
  const outIdx = new Array<number>(rank).fill(0);

  for (let flatOut = 0; flatOut < totalSize; flatOut++) {
    // Decode flatOut.
    let rem = flatOut;
    for (let k = 0; k < rank; k++) {
      outIdx[k] = Math.floor(rem / outStrides[k]);
      rem -= outIdx[k] * outStrides[k];
    }

    // Compute source flat index: unshift each axis.
    let flatIn = 0;
    for (let k = 0; k < rank; k++) {
      const dim = t.shape[k];
      const srcK = (((outIdx[k] - axisShift[k]) % dim) + dim) % dim;
      flatIn += srcK * inStrides[k];
    }

    outData[flatOut] = t.data[flatIn];
  }

  // Axis labels: preserve from t (output shape == t.shape).
  let outLabels: ReadonlyArray<Index> | undefined;
  if (t.axisLabels !== undefined) outLabels = [...t.axisLabels];

  return new Tensor([...t.shape], outData, outLabels);
}
