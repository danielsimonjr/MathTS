/**
 * slice — extract a sub-tensor by per-axis [start, stop, step] ranges.
 *
 * Mirrors NumPy / JAX basic slicing semantics:
 *   - Negative indices wrap around: -1 refers to the last element.
 *   - `null` range for an axis means "take the entire axis".
 *   - `step` must be >= 1 (reverse-step slicing is deferred).
 *   - Output shape for axis i: Math.ceil((stop - start) / step).
 *
 * Axis-label semantics: labels from the input axes are preserved in the
 * output. A slice is still the same logical axis — just smaller — so the
 * label name and tags are carried forward (dimension is updated to match the
 * new axis size; the id is re-minted since the Index type is immutable and
 * dimension is part of the index identity).
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

export interface SliceRange {
  /** Default 0. Supports negative indexing: -1 means shape[axis]-1. */
  start?: number;
  /** Default = shape[axis]. Supports negative indexing. */
  stop?: number;
  /** Default 1. Must be >= 1 (no reverse step). */
  step?: number;
}

/**
 * Extract a sub-tensor by per-axis `SliceRange` triples.
 *
 * @param t      - Input tensor of any rank.
 * @param ranges - Array of length `t.shape.length`. Each element is either a
 *                 `SliceRange` or `null` (which means "take the entire axis").
 *                 Must have the same length as `t.shape`.
 * @returns A new `Tensor` whose shape[i] = ceil((stop_i - start_i) / step_i),
 *          carrying preserved axis labels (same name/tags, updated dim).
 *
 * @throws {RangeError} If `step` is not a positive integer.
 * @throws {Error}      If `ranges.length !== t.shape.length`.
 *
 * @example
 * // Extract rows 1–3 (exclusive), all columns from a 5×4 tensor:
 * const sub = slice(t, [{ start: 1, stop: 3 }, null]);
 */
export function slice(t: Tensor, ranges: (SliceRange | null)[]): Tensor {
  const rank = t.shape.length;

  if (ranges.length !== rank) {
    throw new Error(`slice: ranges length ${ranges.length} does not match tensor rank ${rank}`);
  }

  // Resolve ranges to concrete [start, stop, step] triples.
  const resolved = ranges.map((r, axis) => {
    const dim = t.shape[axis];
    const step = r?.step ?? 1;
    if (!Number.isInteger(step) || step < 1) {
      throw new RangeError(`slice: step must be a positive integer (axis ${axis}), got ${step}`);
    }
    let start = r?.start ?? 0;
    let stop = r?.stop ?? dim;
    // Normalise negative indices.
    if (start < 0) start = dim + start;
    if (stop < 0) stop = dim + stop;
    // Clamp stop to valid range; validate start.
    if (start < 0 || start > dim) {
      throw new RangeError(
        `slice: start ${r?.start} is out of range for axis ${axis} with dim ${dim}`
      );
    }
    stop = Math.max(0, Math.min(stop, dim));
    return { start, stop, step };
  });

  // Compute output shape.
  const outShape = resolved.map(({ start, stop, step }) =>
    start >= stop ? 0 : Math.ceil((stop - start) / step)
  );

  const outSize = outShape.reduce((a, b) => a * b, 1);
  const outData = new Float64Array(outSize);

  if (outSize > 0) {
    const inStrides = Tensor.rowMajorStrides(t.shape);
    const outStrides = Tensor.rowMajorStrides(outShape);

    // Iterate over all output positions using a multi-index counter.
    const outIdx = new Array<number>(rank).fill(0);
    for (let flatOut = 0; flatOut < outSize; flatOut++) {
      // Decode flatOut into outIdx.
      let rem = flatOut;
      for (let k = 0; k < rank; k++) {
        outIdx[k] = Math.floor(rem / outStrides[k]);
        rem -= outIdx[k] * outStrides[k];
      }

      // Map output multi-index → input multi-index.
      let flatIn = 0;
      for (let k = 0; k < rank; k++) {
        const inK = resolved[k].start + outIdx[k] * resolved[k].step;
        flatIn += inK * inStrides[k];
      }

      outData[flatOut] = t.data[flatIn];
    }
  }

  // Axis labels: preserve input labels with updated dims.
  let outLabels: ReadonlyArray<Index> | undefined;
  if (t.axisLabels !== undefined) {
    outLabels = t.axisLabels.map((lbl, k) => {
      const newDim = outShape[k];
      // Create a new Index with the same name and tags, but updated dimension.
      // dim must be >= 1; for empty-slice axes use a placeholder dim of 1.
      return new Index(Math.max(1, newDim), { name: lbl.name, tags: [...lbl.tags] });
    });
  }

  return new Tensor(outShape, outData, outLabels);
}
