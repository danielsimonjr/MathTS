/**
 * Structured and indefinite direct linear solvers.
 *
 * These exploit matrix structure (tridiagonal, banded, Toeplitz, symmetric
 * indefinite) to solve `Ax = b` in less than the O(n^3) a general dense LU
 * (`lusolve`) would cost, or — for `ldl` — to factor matrices `cholesky`
 * cannot handle because they are not positive-definite (e.g. KKT systems):
 *
 * - `thomasSolve` — the Thomas algorithm, O(n) for tridiagonal systems.
 * - `solveBanded` — banded-aware Gaussian elimination (no pivoting; touches
 *   only the O(n(l+u)) entries inside the band), for systems with `l` lower
 *   and `u` upper nonzero diagonals.
 * - `toeplitzSolve` — the Levinson–Durbin recursion, O(n^2) for a Toeplitz
 *   system given only its first row and column.
 * - `ldl` — Bunch–Kaufman-pivoted LDLᵀ factorization of a symmetric
 *   (possibly indefinite) matrix, with 1x1/2x2 diagonal blocks.
 *
 * @packageDocumentation
 */

/**
 * Thomas algorithm — O(n) solve of a tridiagonal system `Ax = d`.
 *
 * `A` is the tridiagonal matrix with subdiagonal `sub` (length n−1),
 * diagonal `diag` (length n), and superdiagonal `sup` (length n−1). No
 * pivoting is performed (as with any tridiagonal Thomas solve); the matrix
 * should be diagonally dominant or otherwise stable without it.
 *
 * @example
 * thomasSolve([-1, -1], [2, 2, 2], [-1, -1], [1, 0, 1]) // => [1, 1, 1]
 */
export function thomasSolve(sub: number[], diag: number[], sup: number[], d: number[]): number[] {
  const n = diag.length;
  if (n === 0) return [];
  if (sub.length !== n - 1 || sup.length !== n - 1 || d.length !== n) {
    throw new Error(
      `thomasSolve: expected sub/sup of length ${n - 1} and d of length ${n}, got sub=${sub.length}, sup=${sup.length}, d=${d.length}`
    );
  }

  const cp = new Array<number>(n).fill(0);
  const dp = new Array<number>(n).fill(0);

  if (diag[0] === 0) throw new Error('thomasSolve: zero pivot at row 0 (no pivoting is performed)');
  cp[0] = n > 1 ? sup[0] / diag[0] : 0;
  dp[0] = d[0] / diag[0];

  for (let i = 1; i < n; i++) {
    const m = diag[i] - sub[i - 1] * cp[i - 1];
    if (m === 0) {
      throw new Error(`thomasSolve: zero pivot at row ${i} (no pivoting is performed)`);
    }
    cp[i] = i < n - 1 ? sup[i] / m : 0;
    dp[i] = (d[i] - sub[i - 1] * dp[i - 1]) / m;
  }

  const x = new Array<number>(n);
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    x[i] = dp[i] - cp[i] * x[i + 1];
  }
  return x;
}

/**
 * Banded-aware Gaussian elimination — solve `Ax = b` for a matrix with `l`
 * nonzero lower diagonals and `u` nonzero upper diagonals (all other entries
 * are assumed zero, though `A` is passed as a full dense matrix). Only the
 * O(n(l+u)) entries inside the band are touched during elimination and
 * back-substitution. No pivoting is performed — as with {@link thomasSolve},
 * the matrix should be diagonally dominant or otherwise stable without it.
 *
 * @example
 * solveBanded(1, 1, [[2, -1, 0], [-1, 2, -1], [0, -1, 2]], [1, 0, 1]) // => [1, 1, 1]
 */
export function solveBanded(l: number, u: number, A: number[][], b: number[]): number[] {
  const n = A.length;
  if (b.length !== n) {
    throw new Error(`solveBanded: A is ${n}x? but b has length ${b.length}`);
  }
  for (const row of A) {
    if (row.length !== n) throw new Error('solveBanded: A must be a square dense matrix');
  }

  const W = A.map((row) => row.slice());
  const rhs = b.slice();

  for (let k = 0; k < n - 1; k++) {
    const pivot = W[k][k];
    if (pivot === 0)
      throw new Error(`solveBanded: zero pivot at row ${k} (no pivoting is performed)`);
    const iMax = Math.min(n - 1, k + l);
    const jMax = Math.min(n - 1, k + u);
    for (let i = k + 1; i <= iMax; i++) {
      const factor = W[i][k] / pivot;
      if (factor === 0) continue;
      for (let j = k; j <= jMax; j++) {
        W[i][j] -= factor * W[k][j];
      }
      rhs[i] -= factor * rhs[k];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = rhs[i];
    const jMax = Math.min(n - 1, i + u);
    for (let j = i + 1; j <= jMax; j++) {
      sum -= W[i][j] * x[j];
    }
    if (W[i][i] === 0)
      throw new Error(`solveBanded: zero pivot at row ${i} during back-substitution`);
    x[i] = sum / W[i][i];
  }
  return x;
}

/**
 * Levinson–Durbin recursion — O(n²) solve of a Toeplitz system `Tx = b`
 * given only the first column `c` and first row `r` (`c[0]` must equal
 * `r[0]`, the shared diagonal value). `T[i][j] = c[i-j]` for `i >= j`, else
 * `r[j-i]`.
 *
 * Order-recursively builds the solution together with two auxiliary
 * "predictor" vectors — one for `T`, one for `Tᵀ` (mutually coupled via the
 * persymmetry `J T J = Tᵀ` that every Toeplitz matrix has, `J` the
 * reversal/exchange matrix) — which is what makes a general (non-symmetric)
 * Toeplitz system solvable in O(n²) rather than O(n³).
 *
 * @example
 * toeplitzSolve([2, 1], [2, 1], [1, 2]) // => [0, 1]
 */
export function toeplitzSolve(c: number[], r: number[], b: number[]): number[] {
  const n = b.length;
  if (c.length !== n || r.length !== n) {
    throw new Error(
      `toeplitzSolve: expected c and r of length ${n}, got c=${c.length}, r=${r.length}`
    );
  }
  if (Math.abs(c[0] - r[0]) > 1e-12 * (Math.abs(c[0]) + Math.abs(r[0]) + 1)) {
    throw new Error(`toeplitzSolve: c[0] (${c[0]}) must equal r[0] (${r[0]})`);
  }
  const c0 = c[0];
  if (c0 === 0) throw new Error('toeplitzSolve: zero diagonal (c[0] === 0)');

  let x = [b[0] / c0];
  if (n === 1) return x;

  // f solves T_m f = [c[1..m]]; fs ("f-star") solves T_m^T fs = [r[1..m]] —
  // the two mutually-coupled predictor vectors described above.
  let f = [c[1] / c0];
  let fs = [r[1] / c0];

  for (let m = 1; m < n; m++) {
    // v[j] = c[m-j] (j=0..m-1), u[i] = r[m-i] (i=0..m-1): the new
    // border row/column introduced when extending order m to m+1.
    const v = new Array<number>(m);
    const u = new Array<number>(m);
    for (let j = 0; j < m; j++) {
      v[j] = c[m - j];
      u[j] = r[m - j];
    }
    // A = reverse(fs), A* = reverse(f) — see module doc for the persymmetry
    // identity this comes from.
    const A = new Array<number>(m);
    const Astar = new Array<number>(m);
    for (let i = 0; i < m; i++) {
      A[i] = fs[m - 1 - i];
      Astar[i] = f[m - 1 - i];
    }

    let vDotA = 0;
    let vDotX = 0;
    for (let i = 0; i < m; i++) {
      vDotA += v[i] * A[i];
      vDotX += v[i] * x[i];
    }
    const delta = c0 - vDotA;
    if (delta === 0) throw new Error(`toeplitzSolve: breakdown at order ${m + 1} (zero pivot)`);

    const qx = (b[m] - vDotX) / delta;
    const xNew = new Array<number>(m + 1);
    for (let i = 0; i < m; i++) xNew[i] = x[i] - qx * A[i];
    xNew[m] = qx;
    x = xNew;

    if (m + 1 < n) {
      let vDotF = 0;
      let uDotFs = 0;
      for (let i = 0; i < m; i++) {
        vDotF += v[i] * f[i];
        uDotFs += u[i] * fs[i];
      }
      const qf = (c[m + 1] - vDotF) / delta;
      const qfs = (r[m + 1] - uDotFs) / delta;

      const fNew = new Array<number>(m + 1);
      const fsNew = new Array<number>(m + 1);
      for (let i = 0; i < m; i++) {
        fNew[i] = f[i] - qf * A[i];
        fsNew[i] = fs[i] - qfs * Astar[i];
      }
      fNew[m] = qf;
      fsNew[m] = qfs;
      f = fNew;
      fs = fsNew;
    }
  }

  return x;
}

/** Result of {@link ldl}. */
export interface LDLResult {
  /** Unit lower-triangular factor. */
  L: number[][];
  /** Block-diagonal factor (1x1 or 2x2 blocks along the diagonal). */
  D: number[][];
  /**
   * Permutation such that `(P A Pᵀ)[i][j] = A[perm[i]][perm[j]]` and
   * `L D Lᵀ = P A Pᵀ`.
   */
  perm: number[];
}

/**
 * Bunch–Kaufman-pivoted LDLᵀ factorization of a symmetric (possibly
 * indefinite) matrix `A`, useful for symmetric systems `cholesky` can't
 * handle because they aren't positive-definite (e.g. KKT / saddle-point
 * systems from constrained optimization).
 *
 * Reconstruction identity: `L D Lᵀ = P A Pᵀ`, where `P` is the permutation
 * matrix with `P[i][perm[i]] = 1`, i.e. `(P A Pᵀ)[i][j] = A[perm[i]][perm[j]]`.
 * `L` is unit lower-triangular; `D` is block-diagonal with 1x1 or 2x2 blocks
 * (2x2 blocks appear where a pivot would otherwise be too small relative to
 * the rest of its column, per the standard Bunch–Kaufman pivot selection).
 *
 * @example
 * const { L, D, perm } = ldl([[1, 2, 3], [2, 1, 4], [3, 4, 1]]);
 * // L D L^T reconstructs A with rows/cols permuted by perm.
 */
export function ldl(A: number[][]): LDLResult {
  const n = A.length;
  for (const row of A) {
    if (row.length !== n) throw new Error('ldl: A must be a square matrix');
  }

  const W = A.map((row) => row.slice());
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const D: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const perm = Array.from({ length: n }, (_, i) => i);

  const swap = (a: number, b: number): void => {
    if (a === b) return;
    [perm[a], perm[b]] = [perm[b], perm[a]];
    [W[a], W[b]] = [W[b], W[a]];
    for (let i = 0; i < n; i++) [W[i][a], W[i][b]] = [W[i][b], W[i][a]];
    [L[a], L[b]] = [L[b], L[a]];
  };

  const alpha = (1 + Math.sqrt(17)) / 8;
  let k = 0;
  while (k < n) {
    if (k === n - 1) {
      L[k][k] = 1;
      D[k][k] = W[k][k];
      k += 1;
      continue;
    }

    const w1 = Math.abs(W[k][k]);
    let r = k + 1;
    let lambda = Math.abs(W[k + 1][k]);
    for (let i = k + 2; i < n; i++) {
      const val = Math.abs(W[i][k]);
      if (val > lambda) {
        lambda = val;
        r = i;
      }
    }

    let use1x1 = true;
    let swapWith = -1;
    if (lambda !== 0 && w1 < alpha * lambda) {
      let sigma = 0;
      for (let i = k; i < n; i++) {
        if (i !== r) sigma = Math.max(sigma, Math.abs(W[i][r]));
      }
      if (w1 * sigma < alpha * lambda * lambda) {
        if (Math.abs(W[r][r]) >= alpha * sigma) {
          swapWith = r;
        } else {
          use1x1 = false;
          swapWith = r;
        }
      }
    }

    if (use1x1) {
      if (swapWith >= 0) swap(k, swapWith);
      const d = W[k][k];
      L[k][k] = 1;
      D[k][k] = d;
      if (d === 0) throw new Error(`ldl: singular 1x1 pivot at step ${k}`);
      for (let i = k + 1; i < n; i++) L[i][k] = W[i][k] / d;
      for (let i = k + 1; i < n; i++) {
        for (let j = k + 1; j < n; j++) {
          W[i][j] -= L[i][k] * d * L[j][k];
        }
      }
      k += 1;
    } else {
      swap(k + 1, swapWith);
      const a = W[k][k];
      const bVal = W[k][k + 1];
      const cVal = W[k + 1][k];
      const dd = W[k + 1][k + 1];
      const det = a * dd - bVal * cVal;
      if (det === 0) throw new Error(`ldl: singular 2x2 pivot at step ${k}`);
      D[k][k] = a;
      D[k][k + 1] = bVal;
      D[k + 1][k] = cVal;
      D[k + 1][k + 1] = dd;
      L[k][k] = 1;
      L[k + 1][k + 1] = 1;

      for (let i = k + 2; i < n; i++) {
        const wi0 = W[i][k];
        const wi1 = W[i][k + 1];
        L[i][k] = (wi0 * dd - wi1 * cVal) / det;
        L[i][k + 1] = (-wi0 * bVal + wi1 * a) / det;
      }
      for (let i = k + 2; i < n; i++) {
        for (let j = k + 2; j < n; j++) {
          const upd =
            L[i][k] * (a * L[j][k] + bVal * L[j][k + 1]) +
            L[i][k + 1] * (cVal * L[j][k] + dd * L[j][k + 1]);
          W[i][j] -= upd;
        }
      }
      k += 2;
    }
  }

  return { L, D, perm };
}
