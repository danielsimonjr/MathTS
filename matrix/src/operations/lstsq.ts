/**
 * Linear least squares by column-pivoted Householder QR and a complete
 * orthogonal decomposition.
 *
 * Solves `min ||A x - b||_2` for any shape of `A`. When `A` has full column rank
 * the answer is the unique minimiser. When `A` is rank-deficient (or has fewer
 * rows than columns) the answer is the minimum-norm minimiser, as in NumPy's
 * `lstsq`. The factor Q is never formed.
 */

import { matrixSize } from '@danielsimonjr/mathts-core/internal';
import type { DenseMatrix } from '../types/DenseMatrix.js';
import type { SparseMatrix } from '../types/SparseMatrix.js';
import { readRightHandSide } from './right-hand-side.js';
import { decompositionInputToNestedArray, type DecompositionMatrixInput } from './as-packed.js';
import { applyReflector, columnPivotedQr, columnReflector } from './pivoted-qr.js';
import { SQUARED } from './common.js';

/** Machine epsilon for double precision (2^-52). */
const LSTSQ_EPS = 2.220446049250313e-16;

/**
 * Least-squares solution of `A x ≈ b`.
 *
 * Uses column-pivoted Householder QR. The numerical rank is the number of diagonal
 * entries of R above `eps * max(m, n) * |R[0][0]|`. A rank-deficient or wide system
 * returns the minimum-norm solution. Rank is judged after pivoting, so a column that
 * is tiny next to the others is treated as zero, as in NumPy.
 *
 * @param A - `DenseMatrix`, `SparseMatrix`, nested `number[][]`, square `Float64Array`, or `{ data, rows, cols }`.
 * @param b - Right-hand side, read by `readRightHandSide`: a vector with one entry per row of `A`
 *   (a 1-D array or a typed array of numbers), an `m x k` nested array, a `DenseMatrix` or a
 *   `SparseMatrix` (`m` rows: an `m x k` right side; one row and `m` columns: a vector), or an
 *   object with a `toArray` method (the MathJS matrix). An entry that is a numeric string, a
 *   boolean or a bigint is read as its number; `null` and `undefined` are 0.
 * @returns The `n`-vector `x` for a vector `b`, or the `n x k` nested array for a matrix `b`.
 * @throws {RangeError} if `b` has the wrong length or any entry is not finite.
 * @throws {TypeError} if `A` or `b` is not rectangular, `b` is not a vector or a matrix, an
 *   entry of `b` has no conversion to number, or an entry is a BigNumber, Fraction or Complex.
 */
export function lstsq(A: DecompositionMatrixInput, b: readonly number[] | Float64Array): number[];
export function lstsq(A: DecompositionMatrixInput, b: readonly (readonly number[])[]): number[][];
export function lstsq(
  A: DecompositionMatrixInput,
  b: DenseMatrix | SparseMatrix
): number[] | number[][];
export function lstsq(
  A: DecompositionMatrixInput,
  b: readonly number[] | Float64Array | readonly (readonly number[])[] | DenseMatrix | SparseMatrix
): number[] | number[][] {
  const rows = decompositionInputToNestedArray(A);
  const m = rows.length;
  // The nested data of a matrix with no rows is `[]`, so the column count of such a matrix
  // comes from the size that it reports.
  const sizeA = m === 0 && !Array.isArray(A) ? matrixSize(A) : undefined;
  const n = m === 0 ? (sizeA?.length === 2 ? sizeA[1] : 0) : rows[0].length;
  const rhs = readRightHandSide('lstsq', b, m);
  if (rhs.typedEntry !== undefined) {
    // lstsq solves in floating point. mathjs has no lstsq, so no typed result exists to match,
    // and a conversion to number would drop the precision that the caller chose.
    throw new TypeError(
      `lstsq: b holds a ${rhs.typedEntry} entry; lstsq takes numbers, or strings, booleans and null that convert to numbers`
    );
  }
  const vectorRhs = rhs.kind === 'vector';
  const bRows: readonly (readonly number[])[] =
    rhs.kind === 'vector' ? rhs.values.map((v) => [v]) : rhs.rows;
  if (bRows.length !== m) {
    throw new RangeError(`lstsq: b has length ${bRows.length}, expected ${m}`);
  }
  const k = rhs.kind === 'vector' ? 1 : rhs.cols;

  // Row-major working copies, scaled so the largest entry is 1 (undone on x).
  const R = new Float64Array(m * n);
  let sA = 0;
  for (let i = 0; i < m; i++) {
    if (rows[i].length !== n) throw new TypeError('lstsq: A must be a rectangular matrix');
    for (let j = 0; j < n; j++) {
      const v = rows[i][j];
      if (!Number.isFinite(v)) throw new RangeError('lstsq: A has a non-finite entry');
      R[i * n + j] = v;
      sA = Math.max(sA, Math.abs(v));
    }
  }
  const Y = new Float64Array(m * k);
  let sB = 0;
  let bMin = Infinity;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < k; j++) {
      const v = bRows[i][j];
      if (!Number.isFinite(v)) {
        throw new RangeError('lstsq: b has a non-finite entry');
      }
      Y[i * k + j] = v;
      sB = Math.max(sB, Math.abs(v));
      if (v !== 0) bMin = Math.min(bMin, Math.abs(v));
    }
  }
  const out = Array.from({ length: n }, () => new Array<number>(k).fill(0));
  const finish = (): number[] | number[][] => (vectorRhs ? out.map((r) => r[0] ?? 0) : out);
  if (sA === 0 || sB === 0 || n === 0) return finish();
  // Dividing b by its largest entry would push a nonzero entry below 2^-1022 and flush
  // its bits (#1124). The solution is linear in b, so b is split into the entries that
  // keep their bits and the entries that do not, and the two solutions are added. The
  // second part has a smaller largest entry, so the split ends after at most 3 levels.
  if (bMin / sB < 2 ** -1022) {
    const part = (kept: boolean): number[][] =>
      bRows.map((row) => row.map((v) => (Math.abs(v) / sB >= 2 ** -1022 === kept ? v : 0)));
    const large = lstsq(rows, part(true));
    const small = lstsq(rows, part(false));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < k; j++)
        out[i][j] = small[i][j] === 0 ? large[i][j] : large[i][j] + small[i][j];
    return finish();
  }
  // z · sB can leave the range of a double (a subnormal sB, or a huge one); the quotient
  // sB / sA is taken first then (#1104). A quotient below 2^-1022 has lost bits, so
  // z / sA is taken first for it (#1124). An ordinary pair keeps the original order.
  const inWindow = (v: number): boolean => v >= 2 ** -SQUARED && v <= 2 ** SQUARED;
  const ratioInWindow = inWindow(sA) && inWindow(sB);
  const ratio = sB / sA;
  const unscale = (z: number): number =>
    ratioInWindow ? (z * sB) / sA : ratio < 2 ** -1022 ? (z / sA) * sB : z * ratio;
  for (let i = 0; i < R.length; i++) R[i] /= sA;
  for (let i = 0; i < Y.length; i++) Y[i] /= sB;

  // Column-pivoted Householder QR. perm[j] is the original index of working column j.
  const steps = Math.min(m, n);
  const perm = columnPivotedQr(R, m, n, (c, v, vv) => applyReflector(Y, k, c, v, vv, 0, k));

  // Numerical rank from the pivoted diagonal.
  const tol = LSTSQ_EPS * Math.max(m, n) * Math.abs(R[0]);
  let rank = 0;
  while (rank < steps && Math.abs(R[rank * n + rank]) > tol) rank++;

  // Solve each right-hand side column; z holds the solution in pivoted order.
  for (let col = 0; col < k; col++) {
    const z = new Float64Array(n);
    if (rank === n) {
      for (let r = n - 1; r >= 0; r--) {
        let s = Y[r * k + col];
        for (let j = r + 1; j < n; j++) s -= R[r * n + j] * z[j];
        z[r] = s / R[r * n + r];
      }
    } else if (rank > 0) {
      minNormSolve(R, n, rank, Y, k, col, z);
    }
    for (let j = 0; j < n; j++) out[perm[j]][col] = unscale(z[j]);
  }
  return finish();
}

/**
 * Minimum-norm solution of `[R11 R12] z = c` (the first `r` rows of the pivoted R).
 * A QR factorisation of `[R11 R12]^T` gives `[R11 R12] = T Q^T` with `T` lower triangular,
 * so `z = Q T^{-1} c`.
 */
function minNormSolve(
  R: Float64Array,
  n: number,
  r: number,
  Y: Float64Array,
  k: number,
  col: number,
  z: Float64Array
): void {
  // M = [R11 R12]^T is n x r.
  const M = new Float64Array(n * r);
  for (let i = 0; i < r; i++) for (let j = 0; j < n; j++) M[j * r + i] = R[i * n + j];
  const reflectors: Array<{ v: Float64Array; vv: number } | null> = [];
  for (let c = 0; c < r; c++) {
    const h = columnReflector(M, r, n, c);
    if (h === null) {
      reflectors.push(null);
      continue;
    }
    applyReflector(M, r, c, h.v, h.vv, c, r);
    M[c * r + c] = h.alpha;
    for (let i = c + 1; i < n; i++) M[i * r + c] = 0;
    reflectors.push({ v: h.v, vv: h.vv });
  }
  // T = upper(M)^T. Forward substitution: T w = c.
  const w = new Float64Array(n);
  for (let i = 0; i < r; i++) {
    let s = Y[i * k + col];
    for (let j = 0; j < i; j++) s -= M[j * r + i] * w[j];
    w[i] = s / M[i * r + i];
  }
  // z = Q [w; 0]: apply the reflectors in reverse order.
  for (let c = r - 1; c >= 0; c--) {
    const h = reflectors[c];
    if (h === null) continue;
    let s = 0;
    for (let i = 0; i < h.v.length; i++) s += h.v[i] * w[c + i];
    const f = (2 * s) / h.vv;
    for (let i = 0; i < h.v.length; i++) w[c + i] -= f * h.v[i];
  }
  z.set(w);
}
