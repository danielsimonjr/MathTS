/**
 * tensorLU — LU decomposition with partial pivoting for rank-N tensors.
 *
 * Mirrors the `tensorSvd` pattern: partitions the axes of `t` into "row"
 * axes and "col" axes, reshapes `t` into a 2-D matrix, performs LU with
 * partial pivoting (Doolittle's algorithm via the matrix primitive), and
 * returns the factors as Tensors.
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
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { lu as matrixLU } from '@danielsimonjr/mathts-matrix';

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
 * Compute the LU decomposition of tensor `t` by partitioning its axes into
 * "row" and "col" groups. The reshaped 2-D matrix must be square.
 *
 * Delegates the core Doolittle algorithm to `@danielsimonjr/mathts-matrix`'s
 * `lu` primitive.
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

  // --- Delegate to matrix LU primitive ---
  const matA = new DenseMatrix(n, n, new Float64Array(permuted.data));
  const { L: matL, U: matU, P: matP } = matrixLU(matA);

  // Convert number[] permutation to Int32Array and compute parity.
  const P = new Int32Array(matP);
  let parity: 1 | -1 = 1;
  // Parity = sign of the permutation: count the number of inversions modulo 2.
  const visited = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (visited[i] || P[i] === i) {
      visited[i] = 1;
      continue;
    }
    // Trace the cycle length.
    let cycleLen = 0;
    let j = i;
    while (!visited[j]) {
      visited[j] = 1;
      j = P[j];
      cycleLen++;
    }
    // A cycle of length c contributes (c-1) transpositions.
    if ((cycleLen - 1) % 2 !== 0) {
      parity = (parity === 1 ? -1 : 1) as 1 | -1;
    }
  }

  const lData = matL.toFloat64Array();
  const uData = matU.toFloat64Array();

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
