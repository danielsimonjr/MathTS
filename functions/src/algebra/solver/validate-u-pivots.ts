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

/**
 * Reject non-finite coefficients and singular upper-triangular factors before
 * backward substitution (same pivot rule as `linsolve`).
 */
export function validateUpperTriangularPivots(U: DenseMatrix | SparseMatrix | unknown[][]): void {
  if (Array.isArray(U)) {
    validateDenseDiagonal(U);
    return;
  }
  if (isDenseMatrix(U)) {
    validateDenseDiagonal((U as DenseMatrix)._data);
    return;
  }
  if (isSparseMatrix(U)) {
    validateSparseDiagonal(U as SparseMatrix);
    return;
  }
  throw new TypeError('Invalid matrix in LU solve validation');
}

function failSingular(): never {
  throw new Error(LUSOLVE_SINGULAR_MESSAGE);
}

function validateDenseDiagonal(data: unknown[][]): void {
  const n = data.length;
  for (let i = 0; i < n; i++) {
    const row = data[i];
    for (let j = 0; j < (row?.length ?? 0); j++) {
      const v = row[j];
      if (typeof v === 'number' && !Number.isFinite(v)) {
        failSingular();
      }
    }
    if (isBadLuFactorPivot(row?.[i])) {
      failSingular();
    }
  }
}

function validateSparseDiagonal(m: SparseMatrix): void {
  const { _values: values, _index: index, _ptr: ptr, _size: size } = m;
  const n = size[0];
  if (!values || !index || !ptr) {
    for (let i = 0; i < n; i++) {
      if (isBadLuFactorPivot(0)) {
        failSingular();
      }
    }
    return;
  }
  for (let j = 0; j < n; j++) {
    let diag: unknown = 0;
    const first = ptr[j];
    const last = ptr[j + 1];
    for (let k = first; k < last; k++) {
      if (index[k] === j) {
        diag = values[k];
      }
    }
    if (typeof diag === 'number' && !Number.isFinite(diag)) {
      failSingular();
    }
    if (isBadLuFactorPivot(diag)) {
      failSingular();
    }
  }
}
