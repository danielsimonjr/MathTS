/**
 * tensorPinv — Moore-Penrose pseudoinverse for rank-N tensors.
 *
 * Partitions the axes of `t` into "row" axes (the axes that form the
 * numerically "tall" side of the matrix) and the remaining "col" axes.
 * Then:
 *   1. Permutes + reshapes `t` to a 2-D matrix M (numRows × numCols).
 *   2. Computes the full SVD:  M = U · diag(S) · V^T.
 *   3. Thresholds small singular values using `rcond`: keep s_i if
 *      s_i > rcond · max(S), else treat as zero.
 *   4. Computes pinv(M) = V · diag(S^+) · U^T   (shape: numCols × numRows).
 *   5. Reshapes the result back into a Tensor with swapped row/col dims.
 *
 * Axis labels: if the input carries `axisLabels`, the output tensor's
 * leading axes get the original col-axis labels and the trailing axes get
 * the original row-axis labels (because the pseudoinverse swaps rows ↔ cols).
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';
import { svd } from '@danielsimonjr/mathts-matrix';

export interface TensorPinvOpts {
  /**
   * Relative condition threshold for singular-value truncation.
   * A singular value s_i is treated as zero when s_i ≤ rcond · max(S).
   * Default: 1e-10.
   */
  rcond?: number;
}

/**
 * Compute the Moore-Penrose pseudoinverse of tensor `t` by partitioning its
 * axes into "row" and "col" groups.
 *
 * @param t        - Input tensor of any rank ≥ 1.
 * @param rowAxes  - Axis indices (integers) or Index objects whose dimensions
 *                   form the row dimension of the effective 2-D matrix. The
 *                   remaining axes form the column dimension.
 * @param opts     - Optional rcond threshold.
 */
export function tensorPinv(
  t: Tensor,
  rowAxes: ReadonlyArray<number | Index>,
  opts?: TensorPinvOpts
): Tensor {
  const rcond = opts?.rcond ?? 1e-10;
  const rank = t.shape.length;

  // Resolve Index objects to integer axis positions.
  const resolvedRowAxes: number[] = rowAxes.map((ax) => {
    if (typeof ax === 'number') {
      return ax;
    }
    // It's an Index — find it in axisLabels.
    if (t.axisLabels === undefined) {
      throw new Error('tensorPinv: received Index in rowAxes but tensor has no axisLabels');
    }
    const pos = t.axisLabels.findIndex((lbl) => lbl.matches(ax));
    if (pos === -1) {
      throw new Error(
        `tensorPinv: Index "${ax.name ?? ax.id.toString()}" not found in tensor axisLabels`
      );
    }
    return pos;
  });

  // --- Validate ---
  for (const ax of resolvedRowAxes) {
    if (!Number.isInteger(ax) || ax < 0 || ax >= rank) {
      throw new RangeError(
        `tensorPinv: rowAxes contains invalid axis ${ax} for tensor of rank ${rank}`
      );
    }
  }

  const rowSet = new Set(resolvedRowAxes);
  if (rowSet.size !== resolvedRowAxes.length) {
    throw new Error('tensorPinv: rowAxes contains duplicate axes');
  }
  const colAxes: number[] = [];
  for (let i = 0; i < rank; i++) {
    if (!rowSet.has(i)) colAxes.push(i);
  }

  if (colAxes.length === 0) {
    throw new Error('tensorPinv: rowAxes covers all axes — at least one col axis is required');
  }
  if (resolvedRowAxes.length === 0) {
    throw new Error('tensorPinv: rowAxes is empty — at least one row axis is required');
  }

  // --- Permute so row axes come first, then col axes ---
  const perm = [...resolvedRowAxes, ...colAxes];
  const permuted = t.transpose(perm);

  const rowDims = resolvedRowAxes.map((ax) => t.shape[ax]);
  const colDims = colAxes.map((ax) => t.shape[ax]);
  const numRows = rowDims.reduce((a, b) => a * b, 1);
  const numCols = colDims.reduce((a, b) => a * b, 1);

  // --- Reshape to 2-D for SVD ---
  const matrix2D: number[][] = Array.from({ length: numRows }, (_, i) =>
    Array.from({ length: numCols }, (_, j) => permuted.data[i * numCols + j])
  );

  // --- Full SVD: M = U · diag(S) · V^T ---
  const { U, S, V } = svd(matrix2D, { tolerance: 1e-12 });
  // U: numRows × numRows, V: numCols × numCols, S: length min(numRows, numCols)

  // --- Threshold singular values ---
  const maxS = S.length > 0 ? S[0] : 0; // S is in descending order
  const Sinv = S.map((s) => (s > rcond * maxS ? 1 / s : 0));

  // --- pinv(M) = V · diag(S^+) · U^T   shape: numCols × numRows ---
  const k = S.length; // min(numRows, numCols)
  const pinvData = new Float64Array(numCols * numRows);
  for (let i = 0; i < numCols; i++) {
    for (let j = 0; j < numRows; j++) {
      let sum = 0;
      for (let l = 0; l < k; l++) {
        // V[i][l] * Sinv[l] * U[j][l]  (U^T means row j, col l of U)
        sum += V[i][l] * Sinv[l] * U[j][l];
      }
      pinvData[i * numRows + j] = sum;
    }
  }

  // --- Build the output shape: [colDims..., rowDims...] ---
  // pinv has the inverse map: col → row, so shape is numCols × numRows
  // but restructured back to the multi-axis version: [...colDims, ...rowDims].
  const outShape = [...colDims, ...rowDims];

  // --- Propagate axisLabels (col axes become leading, row axes become trailing) ---
  let outLabels: ReadonlyArray<Index> | undefined;
  if (t.axisLabels !== undefined) {
    const rowLabels = resolvedRowAxes.map((ax) => t.axisLabels![ax]);
    const colLabels = colAxes.map((ax) => t.axisLabels![ax]);
    outLabels = [...colLabels, ...rowLabels];
  }

  return new Tensor(outShape, pinvData, outLabels);
}
