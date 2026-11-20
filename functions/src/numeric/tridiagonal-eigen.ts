/**
 * Eigenvalues of a real symmetric tridiagonal matrix.
 *
 * Internal module (not exported from the package). It serves the Gauss rules of
 * `gauss-nodes-extra.ts` (Golub–Welsch) and the Mathieu functions of `mathieu.ts`:
 *
 * - {@link symTridiagEigenvalues}: every eigenvalue, by the implicit QL method with Wilkinson
 *   shifts (O(n²), ascending order).
 * - {@link symTridiagEigenvalue}: one eigenvalue by Sturm-sequence bisection (O(n) per step), to
 *   an absolute error of a few units in the last place of the norm of the matrix.
 *
 * The matrix has the diagonal `diag` (length n) and the sub- and super-diagonal `off`
 * (length n − 1, `off[i]` couples `i` and `i + 1`).
 *
 * @packageDocumentation
 */

/** QL iterations per eigenvalue before the method gives up (it needs 2 to 3 in practice). */
const MAX_QL_ITERATIONS = 60;

/** Sturm bisection steps: the interval of doubles halves each step, so 1100 reach any spacing. */
const MAX_BISECTION_STEPS = 1100;

function checkShape(diag: ArrayLike<number>, off: ArrayLike<number>, name: string): void {
  if (diag.length < 1 || off.length !== diag.length - 1) {
    throw new RangeError(`${name}: off must have one entry less than diag, and diag one or more`);
  }
}

/**
 * All eigenvalues of the symmetric tridiagonal matrix `(diag, off)`, ascending.
 *
 * @param diag - Diagonal, length n ≥ 1
 * @param off - Sub-diagonal (equal to the super-diagonal), length n − 1
 * @returns The n eigenvalues in ascending order
 * @throws RangeError if the lengths do not fit
 * @throws Error if an eigenvalue does not converge
 */
export function symTridiagEigenvalues(diag: ArrayLike<number>, off: ArrayLike<number>): number[] {
  checkShape(diag, off, 'symTridiagEigenvalues');
  const n = diag.length;
  const d = Float64Array.from(diag);
  const e = new Float64Array(n);
  for (let i = 0; i < n - 1; i++) e[i] = off[i];
  for (let l = 0; l < n; l++) {
    let iterations = 0;
    let m: number;
    do {
      // Find a negligible off-diagonal entry to split the matrix.
      for (m = l; m < n - 1; m++) {
        const scale = Math.abs(d[m]) + Math.abs(d[m + 1]);
        if (Math.abs(e[m]) <= Number.EPSILON * scale) break;
      }
      if (m !== l) {
        if (iterations++ === MAX_QL_ITERATIONS) {
          throw new Error('symTridiagEigenvalues: the QL iteration did not converge');
        }
        // Wilkinson shift from the leading 2 x 2 block.
        let g = (d[l + 1] - d[l]) / (2 * e[l]);
        let r = Math.hypot(g, 1);
        g = d[m] - d[l] + e[l] / (g + (g >= 0 ? r : -r));
        let s = 1;
        let c = 1;
        let p = 0;
        let i: number;
        for (i = m - 1; i >= l; i--) {
          const f = s * e[i];
          const b = c * e[i];
          r = Math.hypot(f, g);
          e[i + 1] = r;
          if (r === 0) {
            // A rotation underflowed: recover and split the matrix here.
            d[i + 1] -= p;
            e[m] = 0;
            break;
          }
          s = f / r;
          c = g / r;
          g = d[i + 1] - p;
          r = (d[i] - g) * s + 2 * c * b;
          p = s * r;
          d[i + 1] = g + p;
          g = c * r - b;
        }
        if (r === 0 && i >= l) continue;
        d[l] -= p;
        e[l] = g;
        e[m] = 0;
      }
    } while (m !== l);
  }
  return Array.from(d).sort((a, b) => a - b);
}

/** The number of eigenvalues of `(diag, off)` below `x` (the negative pivots of the LDLᵀ sequence). */
function countBelow(
  diag: ArrayLike<number>,
  off2: Float64Array,
  x: number,
  pivmin: number
): number {
  let count = 0;
  let q = diag[0] - x;
  if (Math.abs(q) < pivmin) q = -pivmin;
  if (q < 0) count++;
  for (let i = 1; i < diag.length; i++) {
    q = diag[i] - x - off2[i - 1] / q;
    if (Math.abs(q) < pivmin) q = -pivmin;
    if (q < 0) count++;
  }
  return count;
}

/**
 * The `k`-th smallest eigenvalue (`k` from 0) of the symmetric tridiagonal matrix
 * `(diag, off)`, by Sturm-sequence bisection inside the Gershgorin interval. The result is
 * accurate to a few units in the last place of the largest entry of the matrix, so a small
 * eigenvalue of a matrix with large entries has a large relative error.
 *
 * @param diag - Diagonal, length n ≥ 1
 * @param off - Sub-diagonal (equal to the super-diagonal), length n − 1
 * @param k - Index of the eigenvalue, `0 <= k < n`
 * @returns The eigenvalue
 * @throws RangeError if the lengths do not fit, `k` is out of range, or an entry is not finite
 */
export function symTridiagEigenvalue(
  diag: ArrayLike<number>,
  off: ArrayLike<number>,
  k: number
): number {
  checkShape(diag, off, 'symTridiagEigenvalue');
  const n = diag.length;
  if (!Number.isInteger(k) || k < 0 || k >= n) {
    throw new RangeError(`symTridiagEigenvalue: k must be an integer in [0, ${n - 1}], got ${k}`);
  }
  const off2 = new Float64Array(n - 1);
  let lo = Infinity;
  let hi = -Infinity;
  let maxOff2 = 0;
  for (let i = 0; i < n; i++) {
    const left = i > 0 ? Math.abs(off[i - 1]) : 0;
    const right = i < n - 1 ? Math.abs(off[i]) : 0;
    lo = Math.min(lo, diag[i] - left - right);
    hi = Math.max(hi, diag[i] + left + right);
    if (i < n - 1) {
      off2[i] = off[i] * off[i];
      maxOff2 = Math.max(maxOff2, off2[i]);
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(maxOff2)) {
    throw new RangeError('symTridiagEigenvalue: every entry and its square must be finite');
  }
  const pivmin = Number.MIN_VALUE * 1e10 * Math.max(1, maxOff2);
  // Invariant: count(lo) <= k < count(hi), so the k-th eigenvalue lies in [lo, hi).
  hi += Math.max(Math.abs(hi), 1) * Number.EPSILON;
  for (let step = 0; step < MAX_BISECTION_STEPS; step++) {
    const mid = lo + (hi - lo) / 2;
    if (mid === lo || mid === hi) break;
    if (countBelow(diag, off2, mid, pivmin) > k) hi = mid;
    else lo = mid;
    if (hi - lo <= 2 * Number.EPSILON * Math.max(Math.abs(lo), Math.abs(hi))) break;
  }
  return lo + (hi - lo) / 2;
}
