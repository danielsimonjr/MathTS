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
 * backward substitution. A pivot is judged against the largest term that the elimination
 * subtracted from it (see {@link isBadLuFactorPivot}).
 *
 * That scale comes from the two factors alone, so it also serves a factorization that the
 * caller made earlier: for the pivot `U[i][i]` it is `max over k < i of |L[i][k] * U[k][i]|`.
 *
 * @param U Upper-triangular factor (Array, DenseMatrix or SparseMatrix).
 * @param L Unit lower-triangular factor, with the rows aligned to the rows of `U`.
 */
export function validateUpperTriangularPivots(U: Factor, L: Factor): void {
  const n = factorRows(U);
  // |L[i][k]| below the diagonal, keyed by i * n + k.
  const lower = new Map<number, number>();
  forEachNumber(L, (i, k, v) => {
    if (k < i && v !== 0) lower.set(i * n + k, Math.abs(v));
  });
  const scale = new Float64Array(n);
  forEachNumber(U, (k, i, v) => {
    if (!Number.isFinite(v)) failSingular();
    if (k >= i || i >= n) return;
    const l = lower.get(i * n + k);
    if (l === undefined) return;
    const t = l * Math.abs(v);
    if (t > scale[i]) scale[i] = t;
  });
  for (let i = 0; i < n; i++) {
    if (isBadLuFactorPivot(diagonalOf(U, i), scale[i], n)) failSingular();
  }
}

function failSingular(): never {
  throw new Error(LUSOLVE_SINGULAR_MESSAGE);
}

/**
 * Packed twin of {@link validateUpperTriangularPivots} for row-major `n x n`
 * `Float64Array` factors (the storage of a matrix-package `DenseMatrix`). It applies the
 * same rule over the storage and builds no nested array: every entry of `U` must be finite,
 * and no diagonal entry of `U` may be zero or below the pivot floor times its cancellation
 * scale.
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
  for (let at = 0; at < data.length; at++) {
    if (!Number.isFinite(data[at])) failSingular();
  }
  for (let i = 0; i < n; i++) {
    let scale = 0;
    for (let k = 0; k < i; k++) {
      const t = Math.abs(lower[i * n + k] * data[k * n + i]);
      if (t > scale) scale = t;
    }
    if (isBadLuFactorPivot(data[i * n + i], scale, n)) failSingular();
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
