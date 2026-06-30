/**
 * tensorEig — eigenvalue / eigenvector decomposition for rank-N tensors.
 *
 * Mirrors the `tensorSvd` pattern: partitions the axes of `t` into "row"
 * axes and "col" axes, reshapes `t` into a 2-D matrix, and delegates to
 * the DenseMatrix `eig` primitive.
 *
 * The 2-D reshaped input must be square.
 *
 * Routing:
 *   - `symmetric: true`     — eigenvalues are real and eigenvectors are
 *                             orthogonal (matrix routes the symmetric path
 *                             internally).
 *   - `symmetric: false` (default) — general eigensolver. If any eigenvalue
 *                             has a non-zero imaginary part, the result
 *                             includes an `eigenvaluesImaginary` Tensor;
 *                             otherwise the field is undefined.
 *   - `computeVectors: false` — only eigenvalues are returned (faster).
 */

import { Tensor } from '../Tensor.js';
import { eig as matrixEig, eigWasm } from '@danielsimonjr/mathts-matrix';
import type { EigResult } from '@danielsimonjr/mathts-matrix';

export interface TensorEigOpts {
  /** Hint that the input is symmetric; routes through a stable real-eigenvalue path. */
  symmetric?: boolean;
  /** When false, only eigenvalues are computed. Default true. */
  computeVectors?: boolean;
}

export interface TensorEigResult {
  /** Real parts of the eigenvalues. 1-D Tensor of length n. */
  eigenvalues: Tensor;
  /** Eigenvectors as columns; shape [n, n]. Present only when computeVectors !== false. */
  eigenvectors?: Tensor;
  /**
   * Imaginary parts of the eigenvalues. 1-D Tensor of length n.
   * Only present when any eigenvalue has nonzero imaginary part (general
   * non-symmetric case). Undefined when all eigenvalues are real.
   */
  eigenvaluesImaginary?: Tensor;
}

/**
 * Compute the eigendecomposition of tensor `t` by partitioning its axes
 * into "row" and "col" groups. The reshaped 2-D matrix must be square.
 *
 * @param t        - Input tensor of any rank ≥ 1.
 * @param rowAxes  - Axis indices forming the row dimension of the effective
 *                   2-D matrix. The remaining axes form the column dimension.
 * @param opts     - Optional symmetric hint + computeVectors flag.
 */
/** Validate axes, permute to a square 2-D matrix, optionally symmetrize. */
function prepareEigMatrix(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  symmetricHint: boolean
): { matrix2D: number[][]; n: number } {
  const rank = t.shape.length;

  for (const ax of rowAxes) {
    if (!Number.isInteger(ax) || ax < 0 || ax >= rank) {
      throw new RangeError(
        `tensorEig: rowAxes contains invalid axis ${ax} for tensor of rank ${rank}`
      );
    }
  }

  const rowSet = new Set(rowAxes);
  if (rowSet.size !== rowAxes.length) {
    throw new Error('tensorEig: rowAxes contains duplicate axes');
  }
  const colAxes: number[] = [];
  for (let i = 0; i < rank; i++) {
    if (!rowSet.has(i)) colAxes.push(i);
  }

  if (colAxes.length === 0) {
    throw new Error('tensorEig: rowAxes covers all axes — at least one axis must remain');
  }
  if (rowAxes.length === 0) {
    throw new Error('tensorEig: rowAxes is empty — at least one axis must be assigned');
  }

  const rowDims = rowAxes.map((ax) => t.shape[ax]);
  const colDims = colAxes.map((ax) => t.shape[ax]);
  const numRows = rowDims.reduce((a, b) => a * b, 1);
  const numCols = colDims.reduce((a, b) => a * b, 1);

  if (numRows !== numCols) {
    throw new Error(`tensorEig: reshaped matrix must be square (got ${numRows}×${numCols})`);
  }

  const perm = [...rowAxes, ...colAxes];
  const permuted = t.transpose(perm);
  const n = numRows;

  const matrix2D: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => permuted.data[i * n + j])
  );

  // `symmetric: true` symmetrizes to guarantee the symmetric-routing path and
  // nullify FP noise that might flip the internal isSymmetric() check.
  if (symmetricHint) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const avg = (matrix2D[i][j] + matrix2D[j][i]) / 2;
        matrix2D[i][j] = avg;
        matrix2D[j][i] = avg;
      }
    }
  }

  return { matrix2D, n };
}

/** Build eigenvalue/eigenvector Tensors from a matrix EigResult. Shared sync + WASM. */
function finishEig(
  eigResult: EigResult,
  n: number,
  computeVectors: boolean,
  symmetricHint: boolean
): TensorEigResult {
  const { values, vectors } = eigResult;

  // --- Build eigenvalue Tensors ---
  const reData = new Float64Array(n);
  const imData = new Float64Array(n);
  let anyImaginary = false;
  for (let i = 0; i < n; i++) {
    reData[i] = values[i].re;
    imData[i] = values[i].im;
    if (values[i].im !== 0) anyImaginary = true;
  }

  const eigenvalues = new Tensor([n], reData);

  const result: TensorEigResult = { eigenvalues };

  if (anyImaginary && !symmetricHint) {
    result.eigenvaluesImaginary = new Tensor([n], imData);
  }

  if (computeVectors) {
    // `vectors[i]` is the i-th eigenvector (as a row from the matrix
    // primitive). The wrapper convention is "columns are eigenvectors":
    // place vectors[i] as column i of the output.
    const vData = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      const v = vectors[i];
      for (let r = 0; r < n; r++) {
        vData[r * n + i] = v[r];
      }
    }
    result.eigenvectors = new Tensor([n, n], vData);
  }

  return result;
}

/**
 * Tensor eigendecomposition using the pure-JS matrix eig primitive (synchronous).
 */
export function tensorEig(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  opts?: TensorEigOpts
): TensorEigResult {
  const computeVectors = opts?.computeVectors ?? true;
  const symmetricHint = opts?.symmetric ?? false;
  const { matrix2D, n } = prepareEigMatrix(t, rowAxes, symmetricHint);
  return finishEig(matrixEig(matrix2D, { computeVectors }), n, computeVectors, symmetricHint);
}

/**
 * Tensor eigendecomposition routed through the AssemblyScript WASM eig kernel
 * (`eigWasm`) — same result as {@link tensorEig}, accelerated for large
 * matricisations. Async (WASM instantiation); `eigWasm` falls back to JS when no
 * binary is available.
 */
export async function tensorEigWasm(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  opts?: TensorEigOpts
): Promise<TensorEigResult> {
  const computeVectors = opts?.computeVectors ?? true;
  const symmetricHint = opts?.symmetric ?? false;
  const { matrix2D, n } = prepareEigMatrix(t, rowAxes, symmetricHint);
  return finishEig(await eigWasm(matrix2D, { computeVectors }), n, computeVectors, symmetricHint);
}
