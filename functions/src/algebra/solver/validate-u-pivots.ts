import { isDenseMatrix, isSparseMatrix } from '../../utils/is.js';
import { isBadLuFactorPivot, LUSOLVE_SINGULAR_MESSAGE } from './pivot-tolerance.js';

interface DenseMatrix {
  _data: unknown[][];
  _size: number[];
}

interface SparseMatrix {
  _values?: unknown[];
  _index?: number[];
  _ptr?: number[];
  _size: number[];
}

type Factor = DenseMatrix | SparseMatrix | unknown[][];

/**
 * Reject non-finite coefficients and singular upper-triangular factors before
 * backward substitution. A pivot is judged against the scale of its own row, so a
 * small pivot in a small row is valid (see {@link isBadLuFactorPivot}).
 *
 * The row scale comes from the two factors alone, so it also serves a factorization
 * that the caller made earlier: with `umax[k]` the largest absolute entry of row `k`
 * of `U`, the scale of row `i` is `max(umax[i], max over k < i of |L[i][k]| * umax[k])`.
 * A row of `L` holds the multipliers that took the pivot row out of the rows above it, so
 * a pivot that is small against `|L[i][k]| * umax[k]` has lost its digits by cancellation.
 *
 * @param U Upper-triangular factor (Array, DenseMatrix or SparseMatrix).
 * @param L Unit lower-triangular factor, with the rows aligned to the rows of `U`.
 */
export function validateUpperTriangularPivots(U: Factor, L: Factor): void {
  const n = factorRows(U);
  const umax = new Array<number>(n).fill(0);
  forEachNumber(U, (i, _j, v) => {
    if (!Number.isFinite(v)) failSingular();
    const a = Math.abs(v);
    if (a > umax[i]) umax[i] = a;
  });
  const scale = umax.slice();
  forEachNumber(L, (i, k, v) => {
    if (k >= i || i >= n) return;
    const t = Math.abs(v) * umax[k];
    if (t > scale[i]) scale[i] = t;
  });
  for (let i = 0; i < n; i++) {
    if (isBadLuFactorPivot(diagonalOf(U, i), scale[i])) failSingular();
  }
}

function failSingular(): never {
  throw new Error(LUSOLVE_SINGULAR_MESSAGE);
}

/**
 * Packed twin of {@link validateUpperTriangularPivots} for row-major `n x n`
 * `Float64Array` factors (the storage of a matrix-package `DenseMatrix`). It applies the
 * same rule in two passes over the storage and builds no nested array: every entry of `U`
 * must be finite, and no diagonal entry of `U` may be zero or smaller than `LU_PIVOT_TOL`
 * times the scale of its row.
 *
 * @param data Row-major storage of the factor `U`, of length `n * n`.
 * @param n Number of rows and columns.
 * @param lower Row-major storage of the factor `L`, of length `n * n`.
 * @throws {Error} with {@link LUSOLVE_SINGULAR_MESSAGE} when the factor is unusable.
 */
export function validatePackedUpperTriangularPivots(
  data: Float64Array,
  n: number,
  lower: Float64Array
): void {
  const umax = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = 0, at = i * n; j < n; j++, at++) {
      const v = data[at];
      if (!Number.isFinite(v)) failSingular();
      const a = Math.abs(v);
      if (a > m) m = a;
    }
    umax[i] = m;
  }
  for (let i = 0; i < n; i++) {
    let scale = umax[i];
    for (let k = 0, at = i * n; k < i; k++, at++) {
      const t = Math.abs(lower[at]) * umax[k];
      if (t > scale) scale = t;
    }
    if (isBadLuFactorPivot(data[i * n + i], scale)) failSingular();
  }
}

/** Number of rows of a factor. */
function factorRows(M: Factor): number {
  if (Array.isArray(M)) return M.length;
  if (isDenseMatrix(M) || isSparseMatrix(M)) return (M as DenseMatrix | SparseMatrix)._size[0];
  throw new TypeError('Invalid matrix in LU solve validation');
}

/**
 * Visit every stored entry of a factor that is a number, as (row, column, value). An entry
 * that is not a number (BigNumber, Fraction, Complex) is skipped: it is not judged here.
 */
function forEachNumber(M: Factor, visit: (i: number, j: number, v: number) => void): void {
  if (Array.isArray(M) || isDenseMatrix(M)) {
    const rows = Array.isArray(M) ? M : (M as DenseMatrix)._data;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      for (let j = 0; j < (row?.length ?? 0); j++) {
        const v = row[j];
        if (typeof v === 'number') visit(i, j, v);
      }
    }
    return;
  }
  if (isSparseMatrix(M)) {
    const { _values: values, _index: index, _ptr: ptr, _size: size } = M as SparseMatrix;
    if (!values || !index || !ptr) return;
    for (let j = 0; j < size[1]; j++) {
      for (let k = ptr[j]; k < ptr[j + 1]; k++) {
        const v = values[k];
        if (typeof v === 'number') visit(index[k], j, v);
      }
    }
    return;
  }
  throw new TypeError('Invalid matrix in LU solve validation');
}

/** Entry `[i][i]` of a factor. A sparse factor without a stored entry there has a zero. */
function diagonalOf(M: Factor, i: number): unknown {
  if (Array.isArray(M)) return M[i]?.[i];
  if (isDenseMatrix(M)) return (M as DenseMatrix)._data[i]?.[i];
  const { _values: values, _index: index, _ptr: ptr } = M as SparseMatrix;
  if (!values || !index || !ptr) return 0;
  let diag: unknown = 0;
  for (let k = ptr[i]; k < ptr[i + 1]; k++) {
    if (index[k] === i) diag = values[k];
  }
  return diag;
}
