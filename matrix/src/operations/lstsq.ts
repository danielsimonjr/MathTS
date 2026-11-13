/**
 * Linear least squares by column-pivoted Householder QR and a complete
 * orthogonal decomposition.
 *
 * Solves `min ||A x - b||_2` for any shape of `A`. When `A` has full column rank
 * the answer is the unique minimiser. When `A` is rank-deficient (or has fewer
 * rows than columns) the answer is the minimum-norm minimiser, as in NumPy's
 * `lstsq`. The factor Q is never formed.
 */

import { decompositionInputToNestedArray, type DecompositionMatrixInput } from './as-packed.js';

/** Machine epsilon for double precision (2^-52). */
const LSTSQ_EPS = 2.220446049250313e-16;

/** Euclidean norm of `col[from..to)` of a row-major matrix, safe against overflow and underflow. */
function scaledNorm(M: Float64Array, ld: number, col: number, from: number, to: number): number {
  let big = 0;
  for (let i = from; i < to; i++) big = Math.max(big, Math.abs(M[i * ld + col]));
  if (big === 0) return 0;
  let s = 0;
  for (let i = from; i < to; i++) {
    const t = M[i * ld + col] / big;
    s += t * t;
  }
  return big * Math.sqrt(s);
}

/**
 * Builds the reflector that maps `col[k..rows)` onto `alpha * e_k`. Returns the
 * normalised reflector `v` (length rows - k), `v^T v`, and `alpha`, or `null` when the
 * column is already `alpha * e_k`.
 */
function householder(
  M: Float64Array,
  ld: number,
  rows: number,
  k: number
): { v: Float64Array; vv: number; alpha: number } | null {
  const norm = scaledNorm(M, ld, k, k, rows);
  const alpha = M[k * ld + k] > 0 ? -norm : norm;
  const v = new Float64Array(rows - k);
  for (let i = k; i < rows; i++) v[i - k] = M[i * ld + k];
  v[0] -= alpha;
  let big = 0;
  for (let i = 0; i < v.length; i++) big = Math.max(big, Math.abs(v[i]));
  if (big === 0) return null;
  // Normalise v so v^T v can neither underflow nor overflow.
  let vv = 0;
  for (let i = 0; i < v.length; i++) {
    v[i] /= big;
    vv += v[i] * v[i];
  }
  return { v, vv, alpha };
}

/** Applies H = I - 2 v v^T / (v^T v) to columns [c0, c1) of `M`, rows k..k+v.length. */
function applyReflector(
  M: Float64Array,
  ld: number,
  k: number,
  v: Float64Array,
  vv: number,
  c0: number,
  c1: number
): void {
  for (let j = c0; j < c1; j++) {
    let s = 0;
    for (let i = 0; i < v.length; i++) s += v[i] * M[(k + i) * ld + j];
    const f = (2 * s) / vv;
    if (f === 0) continue;
    for (let i = 0; i < v.length; i++) M[(k + i) * ld + j] -= f * v[i];
  }
}

/**
 * Least-squares solution of `A x ≈ b`.
 *
 * Uses column-pivoted Householder QR. The numerical rank is the number of diagonal
 * entries of R above `eps * max(m, n) * |R[0][0]|`. A rank-deficient or wide system
 * returns the minimum-norm solution. Rank is judged after pivoting, so a column that
 * is tiny next to the others is treated as zero, as in NumPy.
 *
 * @param A - `DenseMatrix`, `SparseMatrix`, nested `number[][]`, square `Float64Array`, or `{ data, rows, cols }`.
 * @param b - Right-hand side: a vector with one entry per row of `A`, or an `m x k` nested array.
 * @returns The `n`-vector `x` for a vector `b`, or the `n x k` nested array for a matrix `b`.
 * @throws {RangeError} if `b` has the wrong length or any entry is not finite.
 * @throws {TypeError} if `A` or `b` is not rectangular.
 */
export function lstsq(A: DecompositionMatrixInput, b: readonly number[]): number[];
export function lstsq(A: DecompositionMatrixInput, b: readonly (readonly number[])[]): number[][];
export function lstsq(
  A: DecompositionMatrixInput,
  b: readonly number[] | readonly (readonly number[])[]
): number[] | number[][] {
  const rows = decompositionInputToNestedArray(A);
  const m = rows.length;
  const n = m === 0 ? 0 : rows[0].length;
  const vectorRhs = b.length === 0 || typeof b[0] === 'number';
  const bRows: readonly (readonly number[])[] = vectorRhs
    ? (b as readonly number[]).map((v) => [v])
    : (b as readonly (readonly number[])[]);
  if (bRows.length !== m) {
    throw new RangeError(`lstsq: b has length ${bRows.length}, expected ${m}`);
  }
  const k = m === 0 ? 0 : bRows[0].length;

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
  for (let i = 0; i < m; i++) {
    if (bRows[i].length !== k) {
      throw new TypeError('lstsq: b must be a vector or a rectangular matrix');
    }
    for (let j = 0; j < k; j++) {
      const v = bRows[i][j];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new RangeError('lstsq: b has a non-finite entry');
      }
      Y[i * k + j] = v;
      sB = Math.max(sB, Math.abs(v));
    }
  }
  const out = Array.from({ length: n }, () => new Array<number>(k).fill(0));
  const finish = (): number[] | number[][] => (vectorRhs ? out.map((r) => r[0] ?? 0) : out);
  if (sA === 0 || sB === 0 || n === 0) return finish();
  for (let i = 0; i < R.length; i++) R[i] /= sA;
  for (let i = 0; i < Y.length; i++) Y[i] /= sB;

  // Column-pivoted Householder QR. perm[j] is the original index of working column j.
  const perm = Array.from({ length: n }, (_, j) => j);
  const steps = Math.min(m, n);
  for (let c = 0; c < steps; c++) {
    let best = c;
    let bestNorm = -1;
    for (let j = c; j < n; j++) {
      const nrm = scaledNorm(R, n, j, c, m);
      if (nrm > bestNorm) {
        bestNorm = nrm;
        best = j;
      }
    }
    if (best !== c) {
      for (let i = 0; i < m; i++) {
        const t = R[i * n + c];
        R[i * n + c] = R[i * n + best];
        R[i * n + best] = t;
      }
      [perm[c], perm[best]] = [perm[best], perm[c]];
    }
    const h = householder(R, n, m, c);
    if (h === null) continue; // column is already alpha * e_c
    applyReflector(R, n, c, h.v, h.vv, c, n);
    applyReflector(Y, k, c, h.v, h.vv, 0, k);
    R[c * n + c] = h.alpha;
    for (let i = c + 1; i < m; i++) R[i * n + c] = 0;
  }

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
    for (let j = 0; j < n; j++) out[perm[j]][col] = (z[j] * sB) / sA;
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
    const h = householder(M, r, n, c);
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
