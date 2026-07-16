/**
 * Regular-grid N-D multilinear interpolation — `scipy.interpolate.interpn`
 * (default `method='linear'`, `bounds_error=True`).
 *
 * Given `n` strictly-increasing coordinate arrays (`grids`) and a matching
 * `n`-dimensional array of sampled values, `interpn` evaluates the
 * multilinear interpolant at each query point: for a query point, the
 * bracketing grid cell is located along every axis (binary search), and the
 * result is the weighted average of the `2^n` cell-corner values, weighted
 * by the fractional position within the cell along each axis. This is exact
 * for functions that are affine in each coordinate (e.g. `f(x,y) = x + y`)
 * and reduces to ordinary linear interpolation when `n = 1`.
 *
 * @packageDocumentation
 */

/** A nested numeric array of arbitrary depth (matches an N-D grid's shape). */
export type NDArrayInput = number | readonly NDArrayInput[];

interface AxisLocation {
  /** Index of the lower grid node bracketing the query value. */
  i: number;
  /** Fractional position within the cell, in `[0, 1]`. */
  t: number;
}

/**
 * Flattens a nested N-D array into row-major (C-order) `Float64Array`,
 * validating that its shape matches `shape` at every level.
 */
function flattenND(values: NDArrayInput, shape: readonly number[]): Float64Array {
  const total = shape.reduce((a, b) => a * b, 1);
  const flat = new Float64Array(total);
  let pos = 0;

  function walk(v: NDArrayInput, depth: number): void {
    if (depth === shape.length) {
      if (typeof v !== 'number') {
        throw new Error(
          `interpn: values is nested deeper than grids.length (${shape.length} dimensions)`
        );
      }
      flat[pos++] = v;
      return;
    }
    if (!Array.isArray(v) || v.length !== shape[depth]) {
      const gotLen = Array.isArray(v) ? v.length : 'scalar';
      throw new Error(
        `interpn: values shape mismatch at dimension ${depth} ` +
          `(expected length ${shape[depth]}, got ${gotLen})`
      );
    }
    for (const item of v as readonly NDArrayInput[]) walk(item, depth + 1);
  }

  walk(values, 0);
  return flat;
}

/** Binary-searches a strictly increasing axis for the bracketing cell + fractional offset. */
function locateOnAxis(grid: readonly number[], x: number): AxisLocation {
  const n = grid.length;
  if (x < grid[0] || x > grid[n - 1]) {
    throw new Error(`interpn: query value ${x} is out of bounds [${grid[0]}, ${grid[n - 1]}]`);
  }
  if (n === 1) return { i: 0, t: 0 };

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (grid[mid] <= x) lo = mid;
    else hi = mid;
  }
  const denom = grid[lo + 1] - grid[lo];
  const t = denom === 0 ? 0 : (x - grid[lo]) / denom;
  return { i: lo, t };
}

/**
 * Regular-grid multilinear interpolation, matching `scipy.interpolate.interpn`.
 *
 * @param grids - One strictly-increasing coordinate array per dimension (1 for
 *   1-D, 2 for bilinear, 3 for trilinear, etc.).
 * @param values - Sampled values on the grid, nested `grids.length` levels
 *   deep and shaped `grids.map(g => g.length)` (e.g. for 2-D,
 *   `values[i][j] === f(grids[0][i], grids[1][j])`); for 1-D, a flat
 *   `number[]`.
 * @param query - Points to interpolate at, each with `grids.length` coordinates.
 * @returns The interpolated value at each query point.
 * @throws If a grid axis is not strictly increasing, if `values`' shape
 *   doesn't match `grids`, or if a query point falls outside the grid's
 *   bounding box (matches scipy's default `bounds_error=True` — no
 *   extrapolation).
 *
 * @example
 * const xs = [0, 1, 2], ys = [0, 1, 2];
 * const vals = xs.map((x) => ys.map((y) => x + y)); // f(x,y) = x + y
 * interpn([xs, ys], vals, [[0.5, 0.5]]); // [1] (exact — f is affine)
 */
export function interpn(
  grids: readonly (readonly number[])[],
  values: NDArrayInput,
  query: readonly (readonly number[])[]
): number[] {
  if (grids.length === 0) throw new Error('interpn: at least one grid axis is required');

  for (const grid of grids) {
    if (grid.length < 2) throw new Error('interpn: each grid axis needs at least 2 points');
    for (let i = 1; i < grid.length; i++) {
      if (!(grid[i] > grid[i - 1])) {
        throw new Error('interpn: each grid axis must be strictly increasing');
      }
    }
  }

  const dims = grids.length;
  const shape = grids.map((g) => g.length);
  const flat = flattenND(values, shape);

  const strides = new Array<number>(dims);
  strides[dims - 1] = 1;
  for (let d = dims - 2; d >= 0; d--) strides[d] = strides[d + 1] * shape[d + 1];

  const numCorners = 1 << dims;

  return query.map((q) => {
    if (q.length !== dims) {
      throw new Error(`interpn: query point has ${q.length} coordinates, expected ${dims}`);
    }
    const locs = grids.map((g, d) => locateOnAxis(g, q[d]));

    let result = 0;
    for (let corner = 0; corner < numCorners; corner++) {
      let weight = 1;
      let flatIndex = 0;
      for (let d = 0; d < dims; d++) {
        const bit = (corner >> d) & 1;
        const { i, t } = locs[d];
        weight *= bit ? t : 1 - t;
        flatIndex += (i + bit) * strides[d];
      }
      if (weight !== 0) result += weight * flat[flatIndex];
    }
    return result;
  });
}
