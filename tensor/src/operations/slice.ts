/**
 * slice — extract a sub-tensor by per-axis [start, stop, step] ranges.
 *
 * Mirrors NumPy / JAX basic slicing semantics:
 *   - Negative indices wrap around: -1 refers to the last element.
 *   - `null` range for an axis means "take the entire axis".
 *   - `step` may be negative (full reverse uses default start/stop like NumPy).
 *   - Output is a zero-copy view when possible (non-unit step produces strided views).
 *
 * Axis-label semantics: labels from the input axes are preserved in the
 * output. A slice is still the same logical axis — just smaller — so the
 * label name and tags are carried forward (dimension is updated to match the
 * new axis size; the id is re-minted since the Index type is immutable and
 * dimension is part of the index identity).
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

/** Defines the start, stop, and step of a slice along one axis. */
export interface SliceRange {
  /** Default 0 (step > 0) or dim - 1 (step < 0). Supports negative indexing. */
  start?: number;
  /** Default = shape[axis] (step > 0) or -1 (step < 0). Supports negative indexing. */
  stop?: number;
  /** Default 1. Non-zero integers; may be negative. */
  step?: number;
}

function axisSliceLength(start: number, stop: number, step: number): number {
  if (step > 0) {
    return start >= stop ? 0 : Math.ceil((stop - start) / step);
  }
  return start <= stop ? 0 : Math.ceil((start - stop) / -step);
}

/**
 * NumPy `PySlice_GetIndicesEx` clipping. An omitted bound stays the sentinel
 * (`0` / `dim` or `dim - 1` / `-1`). An explicit index wraps once, then clips
 * so an out-of-range bound is an empty slice rather than an error.
 */
function clipBound(index: number, dim: number, step: number): number {
  if (index < 0) {
    index += dim;
    if (index < 0) return step < 0 ? -1 : 0;
  }
  if (index >= dim) return step < 0 ? dim - 1 : dim;
  return index;
}

/**
 * Extract a sub-tensor by per-axis `SliceRange` triples.
 *
 * @param t      - Input tensor of any rank.
 * @param ranges - Array of length `t.shape.length`. Each element is either a
 *                 `SliceRange` or `null` (which means "take the entire axis").
 *                 Must have the same length as `t.shape`.
 * @returns A new `Tensor` view (or empty tensor) with updated shape/stride.
 */
export function slice(t: Tensor, ranges: (SliceRange | null)[]): Tensor {
  const rank = t.shape.length;

  if (ranges.length !== rank) {
    throw new Error(`slice: ranges length ${ranges.length} does not match tensor rank ${rank}`);
  }

  const inStrides = t.strides.length === rank ? t.strides : Tensor.rowMajorStrides(t.shape);

  const resolved = ranges.map((r, axis) => {
    const dim = t.shape[axis]!;
    const step = r?.step ?? 1;
    if (!Number.isInteger(step) || step === 0) {
      throw new RangeError(`slice: step must be a non-zero integer (axis ${axis}), got ${step}`);
    }
    const start = r?.start === undefined ? (step < 0 ? dim - 1 : 0) : clipBound(r.start, dim, step);
    const stop = r?.stop === undefined ? (step < 0 ? -1 : dim) : clipBound(r.stop, dim, step);
    return { start, stop, step };
  });

  const outShape = resolved.map(({ start, stop, step }) => axisSliceLength(start, stop, step));
  const outSize = outShape.reduce((a, b) => a * b, 1);

  if (outSize === 0) {
    return new Tensor(outShape, new Float64Array(0));
  }

  let offset = t.offset;
  const outStrides = new Array<number>(rank);
  for (let k = 0; k < rank; k++) {
    const { start, step } = resolved[k]!;
    offset += start * inStrides[k]!;
    outStrides[k] = inStrides[k]! * step;
  }

  let outLabels: ReadonlyArray<Index> | undefined;
  if (t.axisLabels !== undefined) {
    outLabels = t.axisLabels.map((lbl, k) => {
      const newDim = outShape[k]!;
      return new Index(Math.max(1, newDim), { name: lbl.name, tags: [...lbl.tags] });
    });
  }

  return new Tensor(outShape, t.data, outLabels, { offset, strides: outStrides });
}
