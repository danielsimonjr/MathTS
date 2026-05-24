/**
 * tensorLU — LU decomposition with partial pivoting for rank-N tensors.
 *
 * Mirrors the `tensorSvd` pattern: partitions the axes of `t` into "row"
 * axes and "col" axes, reshapes `t` into a 2-D matrix, performs LU with
 * partial pivoting (Doolittle's algorithm), and returns the factors as
 * Tensors.
 *
 * The 2-D-reshaped input must be square; otherwise an error is thrown.
 *
 * Decomposition: P · A = L · U, where L is unit lower-triangular and U is
 * upper-triangular. P is returned as the row-permutation array (P[i] is
 * the row index of the original A that was moved to position i).
 *
 * `axisLabels` propagation: L receives the rowAxes labels on its leading
 * dims and a fresh joining Index on its trailing axis; U receives the
 * joining Index on its leading axis and the colAxes labels on its trailing
 * dims.
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

export interface TensorLUResult {
  /** Unit lower-triangular L. Shape [...rowDims, n]. */
  L: Tensor;
  /** Upper-triangular U. Shape [n, ...colDims]. */
  U: Tensor;
  /** Row permutation array of length n. P[i] is the original-row index now at position i. */
  P: Int32Array;
  /** Sign of the permutation (+1 for even, -1 for odd) — useful for det(). */
  parity: 1 | -1;
}

export interface TensorLUOpts {
  /** Optional name for the joining index between L and U. Defaults to "lu". */
  joiningIndexName?: string;
}

/**
 * Perform LU decomposition (with partial pivoting) on a square row-major
 * Float64Array. Returns L, U, P, and the parity of the permutation.
 *
 * The matrix is consumed (cloned internally).
 */
function luDecompose(
  data: Float64Array,
  n: number
): { L: Float64Array; U: Float64Array; P: Int32Array; parity: 1 | -1 } {
  // Working copy — we'll overwrite this with the LU factors stored in the
  // standard "compact" form (L below the diagonal with unit diagonal implicit,
  // U on and above the diagonal).
  const A = new Float64Array(data);
  const perm = new Int32Array(n);
  for (let i = 0; i < n; i++) perm[i] = i;
  let parity: 1 | -1 = 1;

  for (let k = 0; k < n; k++) {
    // --- Partial pivot: find row with the largest absolute value in column k ---
    let pivotRow = k;
    let pivotVal = Math.abs(A[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(A[i * n + k]);
      if (v > pivotVal) {
        pivotVal = v;
        pivotRow = i;
      }
    }

    if (pivotVal === 0) {
      throw new Error('tensorLU: matrix is singular (zero pivot encountered)');
    }

    // --- Swap rows in A and perm ---
    if (pivotRow !== k) {
      for (let j = 0; j < n; j++) {
        const tmp = A[k * n + j];
        A[k * n + j] = A[pivotRow * n + j];
        A[pivotRow * n + j] = tmp;
      }
      const tmpP = perm[k];
      perm[k] = perm[pivotRow];
      perm[pivotRow] = tmpP;
      parity = (parity === 1 ? -1 : 1) as 1 | -1;
    }

    // --- Eliminate below the pivot ---
    const pivot = A[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const factor = A[i * n + k] / pivot;
      A[i * n + k] = factor; // store L[i,k]
      for (let j = k + 1; j < n; j++) {
        A[i * n + j] -= factor * A[k * n + j];
      }
    }
  }

  // --- Extract L (unit lower-triangular) and U (upper-triangular) ---
  const L = new Float64Array(n * n);
  const U = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    L[i * n + i] = 1;
    for (let j = 0; j < i; j++) {
      L[i * n + j] = A[i * n + j];
    }
    for (let j = i; j < n; j++) {
      U[i * n + j] = A[i * n + j];
    }
  }

  return { L, U, P: perm, parity };
}

/**
 * Compute the LU decomposition of tensor `t` by partitioning its axes into
 * "row" and "col" groups. The reshaped 2-D matrix must be square.
 *
 * @param t        - Input tensor of any rank ≥ 1.
 * @param rowAxes  - Axis indices forming the row dimension of the effective
 *                   2-D matrix. The remaining axes form the column dimension.
 * @param opts     - Optional joining-index name.
 */
export function tensorLU(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  opts?: TensorLUOpts
): TensorLUResult {
  const rank = t.shape.length;

  // --- Validate rowAxes ---
  for (const ax of rowAxes) {
    if (!Number.isInteger(ax) || ax < 0 || ax >= rank) {
      throw new RangeError(
        `tensorLU: rowAxes contains invalid axis ${ax} for tensor of rank ${rank}`
      );
    }
  }

  const rowSet = new Set(rowAxes);
  if (rowSet.size !== rowAxes.length) {
    throw new Error('tensorLU: rowAxes contains duplicate axes');
  }
  const colAxes: number[] = [];
  for (let i = 0; i < rank; i++) {
    if (!rowSet.has(i)) colAxes.push(i);
  }

  if (colAxes.length === 0) {
    throw new Error('tensorLU: rowAxes covers all axes — at least one axis must remain for U');
  }
  if (rowAxes.length === 0) {
    throw new Error('tensorLU: rowAxes is empty — at least one axis must be assigned to L');
  }

  const rowDims = rowAxes.map((ax) => t.shape[ax]);
  const colDims = colAxes.map((ax) => t.shape[ax]);
  const numRows = rowDims.reduce((a, b) => a * b, 1);
  const numCols = colDims.reduce((a, b) => a * b, 1);

  if (numRows !== numCols) {
    throw new Error(
      `tensorLU: reshaped matrix must be square (got ${numRows}×${numCols}); ` +
        'LU decomposition requires equal row and column dimensions'
    );
  }

  // --- Permute and reshape to 2-D ---
  const perm = [...rowAxes, ...colAxes];
  const permuted = t.transpose(perm);
  const n = numRows;

  // --- LU factor ---
  const { L: lData, U: uData, P, parity } = luDecompose(permuted.data, n);

  // --- Propagate axisLabels ---
  let lLabels: ReadonlyArray<Index> | undefined;
  let uLabels: ReadonlyArray<Index> | undefined;
  if (t.axisLabels !== undefined) {
    const joiningIndex = new Index(n, {
      name: opts?.joiningIndexName ?? 'lu',
    });
    const rowLabels = rowAxes.map((ax) => t.axisLabels![ax]);
    const colLabels = colAxes.map((ax) => t.axisLabels![ax]);
    lLabels = [...rowLabels, joiningIndex];
    uLabels = [joiningIndex, ...colLabels];
  }

  const L = new Tensor([...rowDims, n], lData, lLabels);
  const U = new Tensor([n, ...colDims], uData, uLabels);

  return { L, U, P, parity };
}
