/**
 * tensorQr — QR decomposition for rank-N tensors.
 *
 * Mirrors the `tensorSvd` pattern: partitions the axes of `t` into "row" axes
 * (joining with Q) and "col" axes (joining with R), permutes + reshapes `t`
 * into a 2-D matrix, calls the DenseMatrix `qr` primitive, then reshapes Q
 * and R back into Tensors.
 *
 * In 'reduced' mode (default, thin QR):
 *   Q has shape [...rowDims, k]   where k = min(numRows, numCols)
 *   R has shape [k, ...colDims]
 *
 * In 'full' mode:
 *   Q has shape [...rowDims, numRows]   (square in the row direction)
 *   R has shape [numRows, ...colDims]
 *
 * `axisLabels` propagation: when the input carries labels, the row-axis
 * labels are forwarded to Q's leading dims and the col-axis labels to R's
 * trailing dims. A fresh "joining" Index of dimension `k` (or `numRows` in
 * full mode) is inserted between them.
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';
import { DenseMatrix, qr as matrixQR } from '@danielsimonjr/mathts-matrix';

export interface TensorQrOpts {
  /** 'reduced' (default, thin QR) or 'full'. */
  mode?: 'reduced' | 'full';
  /**
   * Optional name for the joining index between Q and R. Used only when
   * input axisLabels are present to label the new joining axis. Defaults
   * to "qr".
   */
  joiningIndexName?: string;
}

export interface TensorQrResult {
  /** Q factor with orthonormal columns reshaped to [...rowDims, k]. */
  Q: Tensor;
  /** R factor (upper-triangular) reshaped to [k, ...colDims]. */
  R: Tensor;
}

/**
 * Compute the QR decomposition of tensor `t` by partitioning its axes into
 * "row" and "col" groups.
 *
 * @param t        - Input tensor of any rank ≥ 1.
 * @param rowAxes  - Axis indices forming the row dimension of the effective
 *                   2-D matrix. The remaining axes form the column dimension.
 * @param opts     - Optional mode + naming settings.
 */
export function tensorQr(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  opts?: TensorQrOpts
): TensorQrResult {
  const rank = t.shape.length;
  const mode = opts?.mode ?? 'reduced';

  // --- Validate rowAxes ---
  for (const ax of rowAxes) {
    if (!Number.isInteger(ax) || ax < 0 || ax >= rank) {
      throw new RangeError(
        `tensorQr: rowAxes contains invalid axis ${ax} for tensor of rank ${rank}`
      );
    }
  }

  const rowSet = new Set(rowAxes);
  if (rowSet.size !== rowAxes.length) {
    throw new Error('tensorQr: rowAxes contains duplicate axes');
  }
  const colAxes: number[] = [];
  for (let i = 0; i < rank; i++) {
    if (!rowSet.has(i)) colAxes.push(i);
  }

  if (colAxes.length === 0) {
    throw new Error('tensorQr: rowAxes covers all axes — at least one axis must remain for R');
  }
  if (rowAxes.length === 0) {
    throw new Error('tensorQr: rowAxes is empty — at least one axis must be assigned to Q');
  }

  // --- Permute so row axes come first, then col axes ---
  const perm = [...rowAxes, ...colAxes];
  const permuted = t.transpose(perm);

  const rowDims = rowAxes.map((ax) => t.shape[ax]);
  const colDims = colAxes.map((ax) => t.shape[ax]);

  const numRows = rowDims.reduce((a, b) => a * b, 1);
  const numCols = colDims.reduce((a, b) => a * b, 1);

  // --- Reshape to 2-D DenseMatrix ---
  const mat = new DenseMatrix(numRows, numCols, permuted.data.slice());

  // --- Call matrix QR primitive ---
  const { Q: qMat, R: rMat } = matrixQR(mat, { mode });

  const qCols = qMat.cols; // = min(m,n) reduced; = m full
  const rRows = rMat.rows;

  // qMat is row-major Float64Array of shape (numRows × qCols)
  const qData = qMat.toFloat64Array();
  // rMat is row-major Float64Array of shape (rRows × numCols)
  const rData = rMat.toFloat64Array();

  // --- Build output Tensors ---
  // Propagate axisLabels if present.
  let qLabels: ReadonlyArray<Index> | undefined;
  let rLabels: ReadonlyArray<Index> | undefined;
  if (t.axisLabels !== undefined) {
    const joiningDim = qCols;
    const joiningIndex = new Index(joiningDim, {
      name: opts?.joiningIndexName ?? 'qr',
    });
    const rowLabels = rowAxes.map((ax) => t.axisLabels![ax]);
    const colLabels = colAxes.map((ax) => t.axisLabels![ax]);
    qLabels = [...rowLabels, joiningIndex];
    rLabels = [joiningIndex, ...colLabels];
  }

  const qTensor = new Tensor([...rowDims, qCols], qData, qLabels);
  const rTensor = new Tensor([rRows, ...colDims], rData, rLabels);

  return { Q: qTensor, R: rTensor };
}
