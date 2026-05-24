/**
 * tensorSvd — truncated SVD for rank-N tensors.
 *
 * Partitions the axes of `t` into "row" axes (joining with U) and "col" axes
 * (the remaining axes, joining with V), permutes + reshapes `t` into a 2-D
 * matrix, calls the existing DenseMatrix SVD primitive, optionally truncates
 * the singular-value spectrum, and reshapes U / S / V back into Tensors.
 *
 * Phase-2 note: `rowAxes` is positional-integer-only. The named-Index overload
 * (accepting `ReadonlyArray<Index>`) is reserved for the Phase-1-enabled
 * follow-up once `Index` is part of the Tensor surface.
 *
 * The `joiningIndexName` option is accepted for forward-compatibility with the
 * labelled-tensor extension but is unused in Phase 2 — the output Tensors carry
 * no `axisLabels`.
 */

import { Tensor } from '../Tensor.js';
import { svd } from '@danielsimonjr/mathts-matrix';

export interface TensorSvdOpts {
  /** If set, keep at most `maxdim` singular values. */
  maxdim?: number;
  /**
   * If set, drop singular values whose absolute value is strictly less than
   * `cutoff`. Default is 0 (no cutoff). The test is `s >= cutoff`.
   */
  cutoff?: number;
  /**
   * Accepted for forward-compatibility with the labelled-tensor extension
   * (Phase-2-extension follow-up). Currently unused — output Tensors carry
   * no `axisLabels` in Phase 2.
   */
  joiningIndexName?: string;
}

export interface TensorSvdResult {
  /** U factor reshaped to [...rowDims, k]. */
  U: Tensor;
  /** Singular values as a rank-1 Tensor of shape [k]. */
  S: Tensor;
  /** V factor reshaped to [k, ...colDims]. */
  V: Tensor;
  /** Number of singular values retained after truncation. */
  truncatedDim: number;
  /** Sum of squares of the dropped singular values (Frobenius-norm squared of the discarded part). */
  truncationError: number;
}

/**
 * Compute the (optionally truncated) SVD of tensor `t` by partitioning its
 * axes into "row" and "col" groups.
 *
 * @param t        - Input tensor of any rank ≥ 1.
 * @param rowAxes  - Axis indices (integers) whose dimensions form the row
 *                   dimension of the effective 2-D matrix. The remaining axes
 *                   form the column dimension. The order of `rowAxes` controls
 *                   the layout of the U output tensor.
 * @param opts     - Optional truncation / naming settings.
 */
export function tensorSvd(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  opts?: TensorSvdOpts
): TensorSvdResult {
  const rank = t.shape.length;

  // --- Validate rowAxes ---
  for (const ax of rowAxes) {
    if (!Number.isInteger(ax) || ax < 0 || ax >= rank) {
      throw new RangeError(
        `tensorSvd: rowAxes contains invalid axis ${ax} for tensor of rank ${rank}`
      );
    }
  }

  const rowSet = new Set(rowAxes);
  const colAxes: number[] = [];
  for (let i = 0; i < rank; i++) {
    if (!rowSet.has(i)) colAxes.push(i);
  }

  if (colAxes.length === 0) {
    throw new Error('tensorSvd: rowAxes covers all axes — at least one axis must remain for V');
  }
  if (rowAxes.length === 0) {
    throw new Error('tensorSvd: rowAxes is empty — at least one axis must be assigned to U');
  }

  // --- Permute so row axes come first, then col axes ---
  // perm[i] is the original axis that goes to position i after permutation.
  const perm = [...rowAxes, ...colAxes];

  const permuted = t.transpose(perm);

  // Shapes after permutation
  const rowDims = rowAxes.map((ax) => t.shape[ax]);
  const colDims = colAxes.map((ax) => t.shape[ax]);

  const numRows = rowDims.reduce((a, b) => a * b, 1);
  const numCols = colDims.reduce((a, b) => a * b, 1);

  // --- Reshape to 2-D matrix (row-major; data already in correct order) ---
  // Build a number[][] for the SVD routine.
  const matrix: number[][] = Array.from({ length: numRows }, (_, i) =>
    Array.from({ length: numCols }, (_, j) => permuted.data[i * numCols + j])
  );

  // --- Call the existing DenseMatrix SVD primitive ---
  const result = svd(matrix, { tolerance: 1e-12 });

  // result.U is (numRows × numRows), result.V is (numCols × numCols),
  // result.S is an array of min(numRows, numCols) values in descending order.
  const { U: fullU, S: allS, V: fullV } = result;

  // --- Truncation ---
  const cutoff = opts?.cutoff ?? 0;
  const maxdim = opts?.maxdim;

  // Keep singular values where s >= cutoff, then apply maxdim cap.
  let k = allS.filter((s) => s >= cutoff).length;
  if (maxdim !== undefined) {
    k = Math.min(k, maxdim);
  }
  // k is at most min(numRows, numCols)
  k = Math.min(k, allS.length);

  // Truncation error: sum of squares of dropped singular values.
  let truncationError = 0;
  for (let i = k; i < allS.length; i++) {
    truncationError += allS[i] * allS[i];
  }

  const truncatedDim = k;

  // --- Build output Tensors ---
  // U_trunc: numRows × k  →  reshape to [...rowDims, k]
  // V_trunc: numCols × k  →  reshape to [k, ...colDims]
  // S_trunc: rank-1, shape [k]

  // Extract the first k columns of U (each row of fullU has numRows entries; column i of U)
  const uData = new Float64Array(numRows * k);
  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < k; j++) {
      uData[i * k + j] = fullU[i][j];
    }
  }
  const uTensor = new Tensor([...rowDims, k], uData);

  // Extract the first k columns of V (each row of fullV has numCols entries)
  // We want V_trunc shaped [k, ...colDims] — so element [j, ...colIdx] = V[colFlatIdx][j].
  // In the raw fullV layout: V[i][j] = j-th left-singular-vector component for col index i.
  // V_trunc[j, flatColIdx] = fullV[flatColIdx][j], so we transpose: (numCols × k) -> (k × numCols).
  const vData = new Float64Array(k * numCols);
  for (let j = 0; j < k; j++) {
    for (let i = 0; i < numCols; i++) {
      vData[j * numCols + i] = fullV[i][j];
    }
  }
  const vTensor = new Tensor([k, ...colDims], vData);

  // S tensor: rank-1, length k
  const sData = new Float64Array(k);
  for (let j = 0; j < k; j++) {
    sData[j] = allS[j];
  }
  const sTensor = new Tensor([k], sData);

  return {
    U: uTensor,
    S: sTensor,
    V: vTensor,
    truncatedDim,
    truncationError,
  };
}
