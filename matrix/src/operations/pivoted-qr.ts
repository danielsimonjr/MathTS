/**
 * Householder reflectors and column-pivoted QR on row-major `Float64Array` storage.
 * Shared by `lstsq` and by the eigenvalue multiplicity report of `eig`.
 */

/** Square root of machine epsilon for double precision. */
const SQRT_EPS = Math.sqrt(2.220446049250313e-16);

/** Euclidean norm of `col[from..to)` of a row-major matrix, safe against overflow and underflow. */
export function scaledNorm(
  M: Float64Array,
  ld: number,
  col: number,
  from: number,
  to: number
): number {
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
export function columnReflector(
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

/**
 * Applies H = I - 2 v v^T / (v^T v) to columns [c0, c1) of `M`, rows k..k+v.length.
 * The loops run along the rows of the row-major storage. Each column still sums its
 * terms in row order, so the result is the same as a column-by-column update.
 */
export function applyReflector(
  M: Float64Array,
  ld: number,
  k: number,
  v: Float64Array,
  vv: number,
  c0: number,
  c1: number
): void {
  const width = c1 - c0;
  if (width <= 0) return;
  const w = new Float64Array(width);
  for (let i = 0; i < v.length; i++) {
    const vi = v[i];
    const row = (k + i) * ld + c0;
    for (let j = 0; j < width; j++) w[j] += vi * M[row + j];
  }
  for (let j = 0; j < width; j++) w[j] = (2 * w[j]) / vv;
  for (let i = 0; i < v.length; i++) {
    const vi = v[i];
    const row = (k + i) * ld + c0;
    for (let j = 0; j < width; j++) M[row + j] -= w[j] * vi;
  }
}

/**
 * Column-pivoted Householder QR of the `rows x cols` matrix `M`, in place. On return the
 * upper triangle of `M` holds R and the entries below the diagonal are zero. The diagonal
 * of R does not grow in magnitude from one row to the next, so it shows the numerical rank.
 *
 * @param M - Row-major matrix. Overwritten with R.
 * @param rows - Number of rows.
 * @param cols - Number of columns, also the row stride.
 * @param onReflector - Called with each reflector after it is applied to `M`: the first
 *   row `c` it acts on, the vector `v` and `v^T v`.
 * @returns `perm`, where `perm[j]` is the original index of working column `j`.
 */
export function columnPivotedQr(
  M: Float64Array,
  rows: number,
  cols: number,
  onReflector?: (c: number, v: Float64Array, vv: number) => void
): number[] {
  const perm = Array.from({ length: cols }, (_, j) => j);
  const steps = Math.min(rows, cols);
  // norm[j] is the norm of column j below the current row. It is downdated after each
  // step, and computed again when the downdate has lost half of its digits against
  // ref[j], the last computed value (the test of LAPACK dgeqp3).
  const norm = new Float64Array(cols);
  const ref = new Float64Array(cols);
  for (let j = 0; j < cols; j++) norm[j] = ref[j] = scaledNorm(M, cols, j, 0, rows);
  for (let c = 0; c < steps; c++) {
    let best = c;
    for (let j = c + 1; j < cols; j++) if (norm[j] > norm[best]) best = j;
    if (best !== c) {
      for (let i = 0; i < rows; i++) {
        const t = M[i * cols + c];
        M[i * cols + c] = M[i * cols + best];
        M[i * cols + best] = t;
      }
      [perm[c], perm[best]] = [perm[best], perm[c]];
      norm[best] = norm[c];
      ref[best] = ref[c];
    }
    const h = columnReflector(M, cols, rows, c);
    if (h !== null) {
      applyReflector(M, cols, c, h.v, h.vv, c, cols);
      onReflector?.(c, h.v, h.vv);
      M[c * cols + c] = h.alpha;
      for (let i = c + 1; i < rows; i++) M[i * cols + c] = 0;
    }
    for (let j = c + 1; j < cols; j++) {
      if (norm[j] === 0) continue;
      const ratio = Math.abs(M[c * cols + j]) / norm[j];
      const kept = Math.max(0, (1 + ratio) * (1 - ratio));
      const lost = kept * (norm[j] / ref[j]) ** 2;
      if (lost <= SQRT_EPS) {
        norm[j] = ref[j] = scaledNorm(M, cols, j, c + 1, rows);
      } else {
        norm[j] *= Math.sqrt(kept);
      }
    }
  }
  return perm;
}
