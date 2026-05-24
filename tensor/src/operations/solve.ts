/**
 * tensorSolve — named-index linear solver for rank-N tensors.
 *
 * Reshapes tensor A into a square matrix and tensor b into a column vector (or
 * multi-column RHS matrix), solves A·x = b via LU decomposition with partial
 * pivoting, and reshapes the solution back.
 *
 * Axis matching:
 *   - When A has `axisLabels` and `b` has `axisLabels`, the "row" axes of A
 *     are matched to axes of `b` by Index identity (ignoring prime level).
 *   - Otherwise `rowAxesA` / `rowAxesB` (integer indices) must be provided,
 *     or the first axes of each tensor are used by default.
 *
 * Constraints:
 *   - The reshaped A must be square (numRows_A × numRows_A).
 *   - A must be non-singular (LU decomposition throws if pivot is zero).
 *   - For multi-RHS, the RHS col dimension must match A's row dimension.
 *
 * Result shape:
 *   - `x` has shape [...colDimsA, ...colDimsB] where colDimsA are the axes
 *     of A not used as row axes and colDimsB are the axes of b not used as
 *     row (contracting) axes.
 *   - When A is square as a whole tensor (rank 2), the result has the same
 *     shape as b.
 *
 * Axis labels: propagated from A's col axes and b's col axes.
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { lu as matrixLU } from '@danielsimonjr/mathts-matrix';

export interface TensorSolveOpts {
  /**
   * Axis indices (integers) or Index objects of A that form the "contracting"
   * (row) side of the square matrix. Default: first `ceil(rank/2)` axes.
   */
  rowAxesA?: ReadonlyArray<number | Index>;
  /**
   * Axis indices (integers) or Index objects of b that form the "contracting"
   * (row) side matched to A's row dimension. Default: first axis of b.
   */
  rowAxesB?: ReadonlyArray<number | Index>;
}

export interface TensorSolveResult {
  /** Solution tensor x satisfying A·x ≈ b. */
  x: Tensor;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolve a mixed number|Index array to integer axis positions for the given tensor. */
function resolveAxes(axes: ReadonlyArray<number | Index>, t: Tensor, label: string): number[] {
  return axes.map((ax) => {
    if (typeof ax === 'number') return ax;
    if (t.axisLabels === undefined) {
      throw new Error(`${label}: received Index in axes but tensor has no axisLabels`);
    }
    const pos = t.axisLabels.findIndex((lbl) => lbl.id === ax.id);
    if (pos === -1) {
      throw new Error(
        `${label}: Index "${ax.name ?? ax.id.toString()}" not found in tensor axisLabels`
      );
    }
    return pos;
  });
}

/**
 * Forward substitution: solve L·y = Pb (L is unit lower-triangular).
 * L is stored as a flat Float64Array (row-major, n×n).
 * Pb is a flat Float64Array (n×nRHS, row-major).
 * Returns y as Float64Array (n×nRHS, row-major).
 */
function forwardSub(L: Float64Array, Pb: Float64Array, n: number, nRHS: number): Float64Array {
  const y = new Float64Array(n * nRHS);
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < nRHS; r++) {
      let sum = Pb[i * nRHS + r];
      for (let j = 0; j < i; j++) {
        sum -= L[i * n + j] * y[j * nRHS + r];
      }
      // L[i][i] = 1 (unit diagonal), so divide by 1.
      y[i * nRHS + r] = sum;
    }
  }
  return y;
}

/**
 * Back substitution: solve U·x = y (U is upper-triangular).
 * U is stored as a flat Float64Array (row-major, n×n).
 * y is a flat Float64Array (n×nRHS, row-major).
 * Returns x as Float64Array (n×nRHS, row-major).
 */
function backSub(U: Float64Array, y: Float64Array, n: number, nRHS: number): Float64Array {
  const x = new Float64Array(n * nRHS);
  for (let i = n - 1; i >= 0; i--) {
    for (let r = 0; r < nRHS; r++) {
      let sum = y[i * nRHS + r];
      for (let j = i + 1; j < n; j++) {
        sum -= U[i * n + j] * x[j * nRHS + r];
      }
      x[i * nRHS + r] = sum / U[i * n + i];
    }
  }
  return x;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Solve A·x = b for x using LU decomposition.
 *
 * @param A    - Coefficient tensor (rank ≥ 2 when reshaped to square).
 * @param b    - Right-hand side tensor.
 * @param opts - Optional axis-selection overrides.
 */
export function tensorSolve(A: Tensor, b: Tensor, opts?: TensorSolveOpts): TensorSolveResult {
  const rankA = A.shape.length;
  const rankB = b.shape.length;

  // --- Determine row axes for A ---
  let rowAxesA: number[];
  if (opts?.rowAxesA !== undefined) {
    rowAxesA = resolveAxes(opts.rowAxesA, A, 'tensorSolve(A)');
  } else if (A.axisLabels !== undefined && b.axisLabels !== undefined) {
    // Named-index matching: A's row axes are those whose Index appears in b's axisLabels.
    rowAxesA = [];
    for (let i = 0; i < rankA; i++) {
      const lbl = A.axisLabels[i];
      if (b.axisLabels.some((blbl) => blbl.id === lbl.id)) {
        rowAxesA.push(i);
      }
    }
    if (rowAxesA.length === 0) {
      // Fall back: use the first half of A's axes.
      const half = Math.ceil(rankA / 2);
      rowAxesA = Array.from({ length: half }, (_, i) => i);
    }
  } else {
    // Default: use the first half of A's axes.
    const half = Math.ceil(rankA / 2);
    rowAxesA = Array.from({ length: half }, (_, i) => i);
  }

  // --- Determine row axes for b ---
  let rowAxesB: number[];
  if (opts?.rowAxesB !== undefined) {
    rowAxesB = resolveAxes(opts.rowAxesB, b, 'tensorSolve(b)');
  } else if (A.axisLabels !== undefined && b.axisLabels !== undefined) {
    // Match b axes that appear in A's row labels.
    const aRowIds = new Set(rowAxesA.map((ax) => A.axisLabels![ax].id));
    rowAxesB = [];
    for (let i = 0; i < rankB; i++) {
      if (aRowIds.has(b.axisLabels[i].id)) {
        rowAxesB.push(i);
      }
    }
    if (rowAxesB.length === 0) {
      rowAxesB = [0];
    }
  } else {
    // Default: first axis of b.
    rowAxesB = [0];
  }

  // --- Validate row axes for A ---
  for (const ax of rowAxesA) {
    if (!Number.isInteger(ax) || ax < 0 || ax >= rankA) {
      throw new RangeError(
        `tensorSolve: rowAxesA contains invalid axis ${ax} for tensor A of rank ${rankA}`
      );
    }
  }
  const rowSetA = new Set(rowAxesA);
  if (rowSetA.size !== rowAxesA.length) {
    throw new Error('tensorSolve: rowAxesA contains duplicate axes');
  }

  // --- Validate row axes for b ---
  for (const ax of rowAxesB) {
    if (!Number.isInteger(ax) || ax < 0 || ax >= rankB) {
      throw new RangeError(
        `tensorSolve: rowAxesB contains invalid axis ${ax} for tensor b of rank ${rankB}`
      );
    }
  }
  const rowSetB = new Set(rowAxesB);
  if (rowSetB.size !== rowAxesB.length) {
    throw new Error('tensorSolve: rowAxesB contains duplicate axes');
  }

  // --- Compute col axes for A and b ---
  const colAxesA: number[] = [];
  for (let i = 0; i < rankA; i++) {
    if (!rowSetA.has(i)) colAxesA.push(i);
  }
  const colAxesB: number[] = [];
  for (let i = 0; i < rankB; i++) {
    if (!rowSetB.has(i)) colAxesB.push(i);
  }

  // --- Compute dimensions ---
  const rowDimsA = rowAxesA.map((ax) => A.shape[ax]);
  const colDimsA = colAxesA.map((ax) => A.shape[ax]);
  const rowDimsB = rowAxesB.map((ax) => b.shape[ax]);
  const colDimsB = colAxesB.map((ax) => b.shape[ax]);

  const numRowsA = rowDimsA.reduce((a, v) => a * v, 1);
  const numColsA = colDimsA.reduce((a, v) => a * v, 1);
  const numRowsB = rowDimsB.reduce((a, v) => a * v, 1);
  const numColsB = colDimsB.length > 0 ? colDimsB.reduce((a, v) => a * v, 1) : 1;

  // A must be square after reshaping.
  if (numRowsA !== numColsA) {
    throw new Error(
      `tensorSolve: reshaped A must be square (got ${numRowsA}×${numColsA}); ` +
        'non-square systems are not supported — use tensorPinv for least-squares'
    );
  }
  const n = numRowsA;

  // The "contracting" dimension of b must match the row dimension of A.
  if (numRowsB !== n) {
    throw new Error(
      `tensorSolve: b's contracting dimension (${numRowsB}) does not match A's dimension (${n})`
    );
  }

  // --- Permute and reshape A to n×n matrix ---
  const permA = [...rowAxesA, ...colAxesA];
  const permutedA = A.transpose(permA);
  const matA = new DenseMatrix(n, n, new Float64Array(permutedA.data));

  // --- LU decompose A ---
  const { L, U, P } = matrixLU(matA);
  const lFlat = L.toFloat64Array();
  const uFlat = U.toFloat64Array();

  // --- Permute and reshape b to (n × nRHS) ---
  const permB = [...rowAxesB, ...colAxesB];
  const permutedB = b.transpose(permB);
  // permutedB.data is (numRowsB × numColsB) = (n × nRHS) row-major.

  // Apply row permutation P to b: Pb[i, :] = b[P[i], :]
  const bFlat = permutedB.data;
  const Pb = new Float64Array(n * numColsB);
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < numColsB; r++) {
      Pb[i * numColsB + r] = bFlat[P[i] * numColsB + r];
    }
  }

  // --- Forward + back substitution ---
  const y = forwardSub(lFlat, Pb, n, numColsB);
  const xFlat = backSub(uFlat, y, n, numColsB);
  // xFlat is (n × numColsB) = (numColsA × numColsB) row-major.

  // --- Build output shape: [...colDimsA, ...colDimsB] ---
  const outShape = [...colDimsA, ...colDimsB];
  // Handle the degenerate case where b has no col axes (scalar RHS).
  const finalShape = outShape.length > 0 ? outShape : [n];

  // --- Propagate axisLabels ---
  let outLabels: ReadonlyArray<Index> | undefined;
  if (A.axisLabels !== undefined || b.axisLabels !== undefined) {
    const aColLabels = A.axisLabels ? colAxesA.map((ax) => A.axisLabels![ax]) : [];
    const bColLabels = b.axisLabels ? colAxesB.map((ax) => b.axisLabels![ax]) : [];
    if (aColLabels.length + bColLabels.length === finalShape.length) {
      outLabels = [...aColLabels, ...bColLabels];
    }
  }

  const xTensor = new Tensor(finalShape, xFlat, outLabels?.length ? outLabels : undefined);
  return { x: xTensor };
}
