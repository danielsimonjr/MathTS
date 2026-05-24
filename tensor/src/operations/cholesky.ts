/**
 * tensorCholesky — Cholesky decomposition for symmetric positive-definite
 * rank-N tensors.
 *
 * Mirrors the `tensorSvd` pattern: partitions the axes of `t` into "row"
 * axes and "col" axes, reshapes `t` into a 2-D matrix, performs the
 * Cholesky decomposition via the standard right-looking algorithm, and
 * returns the factor as a Tensor.
 *
 * The 2-D reshaped input must be square and symmetric positive-definite;
 * otherwise an error is thrown.
 *
 * Decomposition modes:
 *   - default (`lower: true`):  returns L such that A = L · Lᵀ.
 *   - `lower: false`:           returns U such that A = Uᵀ · U.
 *
 * `axisLabels` propagation: the returned factor receives the rowAxes labels
 * on its leading dims and a fresh joining Index on its trailing axis
 * (for L), or the joining Index on the leading axis and colAxes labels on
 * the trailing dims (for U).
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

export interface TensorCholeskyOpts {
  /** When true (default), return L such that A = L·Lᵀ. When false, return U such that A = Uᵀ·U. */
  lower?: boolean;
  /** Optional name for the joining index on the returned factor. Defaults to "cholesky". */
  joiningIndexName?: string;
}

export interface TensorCholeskyResult {
  /** Cholesky factor (lower or upper depending on `opts.lower`). */
  L: Tensor;
}

/**
 * Compute the Cholesky factor L of a symmetric positive-definite matrix
 * stored as a row-major Float64Array. Returns L in row-major form with
 * zeros above the diagonal.
 *
 * Throws "matrix is not positive definite" if a non-positive diagonal
 * pivot is encountered.
 */
function choleskyDecompose(data: Float64Array, n: number): Float64Array {
  const L = new Float64Array(n * n);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = data[i * n + j];
      for (let k = 0; k < j; k++) {
        sum -= L[i * n + k] * L[j * n + k];
      }
      if (i === j) {
        if (sum <= 0) {
          throw new Error('tensorCholesky: matrix is not positive definite');
        }
        L[i * n + j] = Math.sqrt(sum);
      } else {
        const ljj = L[j * n + j];
        if (ljj === 0) {
          throw new Error('tensorCholesky: matrix is not positive definite');
        }
        L[i * n + j] = sum / ljj;
      }
    }
  }
  return L;
}

/**
 * Transpose a square row-major Float64Array of size n×n in place into a
 * new Float64Array.
 */
function transposeSquare(data: Float64Array, n: number): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out[j * n + i] = data[i * n + j];
    }
  }
  return out;
}

/**
 * Compute the Cholesky decomposition of tensor `t` by partitioning its
 * axes into "row" and "col" groups. The reshaped 2-D matrix must be
 * square and symmetric positive-definite.
 *
 * @param t        - Input tensor of any rank ≥ 1.
 * @param rowAxes  - Axis indices forming the row dimension of the effective
 *                   2-D matrix. The remaining axes form the column dimension.
 * @param opts     - Optional triangle selector + naming.
 */
export function tensorCholesky(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  opts?: TensorCholeskyOpts
): TensorCholeskyResult {
  const rank = t.shape.length;
  const lower = opts?.lower ?? true;

  // --- Validate rowAxes ---
  for (const ax of rowAxes) {
    if (!Number.isInteger(ax) || ax < 0 || ax >= rank) {
      throw new RangeError(
        `tensorCholesky: rowAxes contains invalid axis ${ax} for tensor of rank ${rank}`
      );
    }
  }

  const rowSet = new Set(rowAxes);
  if (rowSet.size !== rowAxes.length) {
    throw new Error('tensorCholesky: rowAxes contains duplicate axes');
  }
  const colAxes: number[] = [];
  for (let i = 0; i < rank; i++) {
    if (!rowSet.has(i)) colAxes.push(i);
  }

  if (colAxes.length === 0) {
    throw new Error(
      'tensorCholesky: rowAxes covers all axes — at least one axis must remain for the column factor'
    );
  }
  if (rowAxes.length === 0) {
    throw new Error('tensorCholesky: rowAxes is empty — at least one axis must be assigned');
  }

  const rowDims = rowAxes.map((ax) => t.shape[ax]);
  const colDims = colAxes.map((ax) => t.shape[ax]);
  const numRows = rowDims.reduce((a, b) => a * b, 1);
  const numCols = colDims.reduce((a, b) => a * b, 1);

  if (numRows !== numCols) {
    throw new Error(
      `tensorCholesky: reshaped matrix must be square (got ${numRows}×${numCols})`
    );
  }

  // --- Permute and reshape to 2-D ---
  const perm = [...rowAxes, ...colAxes];
  const permuted = t.transpose(perm);
  const n = numRows;

  // --- Cholesky factor ---
  const lData = choleskyDecompose(permuted.data, n);
  const factorData = lower ? lData : transposeSquare(lData, n);

  // --- Propagate axisLabels ---
  let factorLabels: ReadonlyArray<Index> | undefined;
  if (t.axisLabels !== undefined) {
    const joiningIndex = new Index(n, {
      name: opts?.joiningIndexName ?? 'cholesky',
    });
    const rowLabels = rowAxes.map((ax) => t.axisLabels![ax]);
    const colLabels = colAxes.map((ax) => t.axisLabels![ax]);
    if (lower) {
      // L : [...rowDims, n]
      factorLabels = [...rowLabels, joiningIndex];
    } else {
      // U : [n, ...colDims]
      factorLabels = [joiningIndex, ...colLabels];
    }
  }

  const factorShape = lower ? [...rowDims, n] : [n, ...colDims];
  const factor = new Tensor(factorShape, factorData, factorLabels);

  return { L: factor };
}
