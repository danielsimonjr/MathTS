/**
 * Control-theory matrix equations — `dlyap`/`care`/`dare`.
 *
 * These solve the algebraic matrix equations that underlie LQR (linear-
 * quadratic regulator) and Kalman-filter design:
 *
 *   - {@link dlyap} — discrete Lyapunov equation `A X Aᵀ − X + Q = 0`, solved
 *     directly via the Kronecker-product linear system
 *     `(I − A⊗A) vec(X) = vec(Q)` (exact for the small `n` this targets;
 *     the codebase's `linsolve` does the O(n²)³ = O(n⁶) dense solve).
 *   - {@link care} — continuous algebraic Riccati equation
 *     `AᵀX + XA − X B R⁻¹ Bᵀ X + Q = 0`, solved via the **matrix sign
 *     function** applied to the Hamiltonian `H = [[A, −BR⁻¹Bᵀ], [−Q, −Aᵀ]]`.
 *     This needs no stabilizing initial gain that a Kleinman/Newton iteration
 *     would require (the natural starting point `X₀ = 0` is not stabilizing
 *     for e.g. the classic double-integrator `A = [[0,1],[0,0]]`, which is only
 *     marginally stable). The sign-function Newton iteration converges
 *     unconditionally (given the standard stabilizability/detectability
 *     assumptions) directly from `H` itself.
 *
 *     The classical alternative is the **Hamiltonian-eigenvector** construction
 *     (eigendecompose `H`, take the stable invariant subspace `U=[U₁;U₂]`,
 *     `X = U₂U₁⁻¹`). Since `matrix`'s `eig` gained complex eigenvectors
 *     (`vectorsIm`, 2026-07-16) that path IS now implementable — but it was
 *     prototyped and **measured against the sign function** (2026-07-18) and
 *     found strictly **less** accurate on every corpus case, with the gap
 *     widening on ill-conditioned Hamiltonians (near-uncontrollable /
 *     lightly-damped: Riccati residual ~1e-10..1e-13 for the eigenvector path
 *     vs ~1e-13..1e-14 for the sign function). Eigenvector-basis subspace
 *     extraction is the numerically inferior classical method (ill-conditioned
 *     eigenvectors near defectiveness), which is why LAPACK/scipy use ordered
 *     Schur, not eigenvectors. The self-contained sign-function method is
 *     therefore retained. (`funm`/`cosm`/`sinm` likewise use eigen*values*,
 *     not eigenvectors — see `matrix-functions.ts`.)
 *   - {@link dare} — discrete algebraic Riccati equation
 *     `AᵀXA − X − AᵀXB(R + BᵀXB)⁻¹BᵀXA + Q = 0`, solved via the
 *     **structure-preserving doubling algorithm** (SDA), the discrete-time
 *     analogue of the sign-function method above: it iterates a triple
 *     `(Aₖ, Gₖ, Hₖ)` with quadratic convergence and, likewise, needs no
 *     stabilizing initial gain.
 *
 * All three return the (numerically symmetrized) stabilizing solution `X`.
 * Both `care`/`dare` require `R` invertible and `(A, B)` stabilizable — the
 * standard LQR well-posedness assumptions.
 *
 * @packageDocumentation
 */

import { linsolve } from '../typed/numeric.js';

// ---------------------------------------------------------------------------
// Local dense-matrix helpers (kept self-contained; this module only needs
// multiply/transpose/add/inverse over plain number[][], not the full Matrix
// class surface).
// ---------------------------------------------------------------------------

function assertSquare(A: number[][], name: string): number {
  const n = A.length;
  if (n === 0) throw new Error(`${name}: empty matrix`);
  for (const row of A) {
    if (row.length !== n)
      throw new Error(`${name}: matrix must be square (got ${n}x${row.length})`);
  }
  return n;
}

function zeros(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

function eye(n: number): number[][] {
  const I = zeros(n, n);
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

function transpose(A: number[][]): number[][] {
  const n = A.length;
  const m = A[0].length;
  const T = zeros(m, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T[j][i] = A[i][j];
  return T;
}

function matmul(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const k = B.length;
  const m = B[0].length;
  const C = zeros(n, m);
  for (let i = 0; i < n; i++) {
    for (let p = 0; p < k; p++) {
      const a = A[i][p];
      if (a === 0) continue;
      for (let j = 0; j < m; j++) C[i][j] += a * B[p][j];
    }
  }
  return C;
}

function matadd(A: number[][], B: number[][], s = 1): number[][] {
  const n = A.length;
  const m = A[0].length;
  const C = zeros(n, m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) C[i][j] = A[i][j] + s * B[i][j];
  return C;
}

function matScale(A: number[][], s: number): number[][] {
  return A.map((row) => row.map((v) => v * s));
}

/** Dense inverse via `linsolve`, one identity column at a time. */
function inv(A: number[][]): number[][] {
  const n = A.length;
  const Inv = zeros(n, n);
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0);
    e[j] = 1;
    const col = linsolve(A, e);
    for (let i = 0; i < n; i++) Inv[i][j] = col[i];
  }
  return Inv;
}

/** Matrix 1-norm (max absolute column sum) — used for sign-function scaling. */
function norm1(A: number[][]): number {
  const n = A.length;
  const m = A[0].length;
  let maxSum = 0;
  for (let j = 0; j < m; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(A[i][j]);
    maxSum = Math.max(maxSum, s);
  }
  return maxSum;
}

function symmetrize(X: number[][]): number[][] {
  return matScale(matadd(X, transpose(X)), 0.5);
}

function maxAbsDiff(A: number[][], B: number[][]): number {
  const n = A.length;
  const m = A[0].length;
  let d = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) d = Math.max(d, Math.abs(A[i][j] - B[i][j]));
  return d;
}

// ---------------------------------------------------------------------------
// dlyap — discrete Lyapunov equation via Kronecker product
// ---------------------------------------------------------------------------

/**
 * Build the row-major "Kronecker-like" operator matrix `L` (size `n²×n²`)
 * representing the linear map `X ↦ M X N` on `vec_row(X)` (row-major
 * vectorization, `vec_row(X)[i*n+j] = X[i][j]`):
 *
 *   `vec_row(M X N) = L · vec_row(X)`,  `L[i*n+j][p*n+q] = M[i][p] · N[q][j]`
 *
 * This is the standard Kronecker identity `vec_row(MXN) = (M ⊗ Nᵀ) vec_row(X)`
 * expressed directly via the map's action on each basis matrix, which
 * sidesteps column-major-vs-row-major convention mistakes.
 */
function sylvesterOperator(M: number[][], N: number[][]): number[][] {
  const n = M.length;
  const n2 = n * n;
  const L = zeros(n2, n2);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const row = i * n + j;
      for (let p = 0; p < n; p++) {
        const mip = M[i][p];
        if (mip === 0) continue;
        for (let q = 0; q < n; q++) {
          L[row][p * n + q] = mip * N[q][j];
        }
      }
    }
  }
  return L;
}

function vecRowMajor(Q: number[][]): number[] {
  const n = Q.length;
  const v = new Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) v[i * n + j] = Q[i][j];
  return v;
}

function unvecRowMajor(v: number[], n: number): number[][] {
  const X = zeros(n, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) X[i][j] = v[i * n + j];
  return X;
}

/**
 * Solve the discrete-time Lyapunov (Stein) equation `A X Aᵀ − X + Q = 0` for
 * `X`, given square `A` and `Q` of the same size.
 *
 * Builds the Kronecker-product linear system `(I − A⊗A) vec(X) = vec(Q)`
 * explicitly (practical for the `n ≲ 20` this targets — the system has
 * `n²` unknowns) and solves it with `linsolve`.
 *
 * @example
 * dlyap([[0.5, 0], [0, 0.5]], [[1, 0], [0, 1]]) // => (4/3) * I  (since 0.25x - x + 1 = 0)
 */
export function dlyap(A: number[][], Q: number[][]): number[][] {
  const n = assertSquare(A, 'dlyap');
  assertSquare(Q, 'dlyap');
  if (Q.length !== n) throw new Error('dlyap: A and Q must have the same size');

  const L = sylvesterOperator(A, transpose(A)); // vec(A X A^T) = L * vec(X)
  const n2 = n * n;
  const M = zeros(n2, n2);
  for (let r = 0; r < n2; r++) {
    for (let c = 0; c < n2; c++) {
      M[r][c] = (r === c ? 1 : 0) - L[r][c];
    }
  }
  const vecQ = vecRowMajor(Q);
  const vecX = linsolve(M, vecQ);
  return symmetrize(unvecRowMajor(vecX, n));
}

// ---------------------------------------------------------------------------
// care — continuous algebraic Riccati equation via matrix sign function
// ---------------------------------------------------------------------------

const RICCATI_MAX_ITER = 100;
const RICCATI_TOL = 1e-13;

/**
 * Solve the continuous-time algebraic Riccati equation (CARE)
 * `AᵀX + XA − X B R⁻¹ Bᵀ X + Q = 0` for the stabilizing symmetric `X`,
 * given `A` (n×n), `B` (n×m), `Q` (n×n, typically PSD), `R` (m×m, invertible).
 *
 * Method: Newton iteration for the **matrix sign function** of the
 * Hamiltonian `H = [[A, −BR⁻¹Bᵀ], [−Q, −Aᵀ]]` (2n×2n):
 *
 *   `Zₖ₊₁ = ½(cₖ Zₖ + cₖ⁻¹ Zₖ⁻¹)`,  `Z₀ = H`,  `cₖ = √(‖Zₖ⁻¹‖₁ / ‖Zₖ‖₁)`
 *
 * converging quadratically to `S = sign(H)`. The projector `P = ½(I − S)`
 * has range equal to `H`'s stable (Re λ < 0) invariant subspace; taking its
 * first `n` columns `U = [U₁; U₂]` (split at the `n`-th row) gives
 * `X = U₂ U₁⁻¹` (real arithmetic throughout — no complex eigenvectors
 * needed, unlike the classical Hamiltonian-eigenvector construction).
 *
 * @example
 * care([[0, 1], [0, 0]], [[0], [1]], [[1, 0], [0, 1]], [[1]])
 * // => [[sqrt(3), 1], [1, sqrt(3)]]  (pinned vs scipy.linalg.solve_continuous_are)
 */
export function care(A: number[][], B: number[][], Q: number[][], R: number[][]): number[][] {
  const n = assertSquare(A, 'care');
  assertSquare(Q, 'care');
  if (Q.length !== n) throw new Error('care: A and Q must have the same size');
  if (B.length !== n) throw new Error('care: B must have n rows (n = size of A)');
  const m = B[0]?.length ?? 0;
  assertSquare(R, 'care');
  if (R.length !== m) throw new Error('care: R must be m x m (m = number of columns of B)');

  const Rinv = inv(R);
  const G = matmul(matmul(B, Rinv), transpose(B)); // B R^-1 B^T, n x n
  const At = transpose(A);

  const n2 = 2 * n;
  let Z = zeros(n2, n2);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      Z[i][j] = A[i][j];
      Z[i][n + j] = -G[i][j];
      Z[n + i][j] = -Q[i][j];
      Z[n + i][n + j] = -At[i][j];
    }
  }

  for (let iter = 0; iter < RICCATI_MAX_ITER; iter++) {
    const Zinv = inv(Z);
    const c = Math.sqrt(norm1(Zinv) / norm1(Z));
    const Znew = matScale(matadd(matScale(Z, c), matScale(Zinv, 1 / c)), 0.5);
    const diff = maxAbsDiff(Znew, Z);
    Z = Znew;
    if (diff < RICCATI_TOL) break;
  }

  const S = Z;
  const P = matScale(matadd(eye(n2), S, -1), 0.5); // P = (I - S) / 2
  const U1 = zeros(n, n);
  const U2 = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      U1[i][j] = P[i][j];
      U2[i][j] = P[n + i][j];
    }
  }
  const X = matmul(U2, inv(U1));
  return symmetrize(X);
}

// ---------------------------------------------------------------------------
// dare — discrete algebraic Riccati equation via structure-preserving doubling
// ---------------------------------------------------------------------------

/**
 * Solve the discrete-time algebraic Riccati equation (DARE)
 * `AᵀXA − X − AᵀXB(R + BᵀXB)⁻¹BᵀXA + Q = 0` for the stabilizing symmetric
 * `X`, given `A` (n×n), `B` (n×m), `Q` (n×n, typically PSD), `R` (m×m,
 * invertible).
 *
 * Method: the **structure-preserving doubling algorithm** (SDA) — the
 * discrete-time analogue of the sign-function iteration used by {@link care}.
 * Starting from `A₀ = A`, `G₀ = B R⁻¹ Bᵀ`, `H₀ = Q`, it iterates
 *
 *   `Aₖ₊₁ = Aₖ(I + GₖHₖ)⁻¹Aₖ`
 *   `Gₖ₊₁ = Gₖ + Aₖ(I + GₖHₖ)⁻¹Gₖ Aₖᵀ`
 *   `Hₖ₊₁ = Hₖ + Aₖᵀ Hₖ(I + GₖHₖ)⁻¹Aₖ`
 *
 * with `Hₖ → X` quadratically. Like {@link care}'s sign-function method, this
 * needs no stabilizing initial gain (unlike a Kleinman/Newton iteration on
 * the DARE directly) — only the standard stabilizability/detectability
 * assumptions.
 *
 * @example
 * dare([[1, 1], [0, 1]], [[0], [1]], [[1, 0], [0, 1]], [[1]])
 * // => [[2.94712297, 2.36920541], [2.36920541, 4.61313426]]
 * //    (pinned vs scipy.linalg.solve_discrete_are)
 */
export function dare(A: number[][], B: number[][], Q: number[][], R: number[][]): number[][] {
  const n = assertSquare(A, 'dare');
  assertSquare(Q, 'dare');
  if (Q.length !== n) throw new Error('dare: A and Q must have the same size');
  if (B.length !== n) throw new Error('dare: B must have n rows (n = size of A)');
  const m = B[0]?.length ?? 0;
  assertSquare(R, 'dare');
  if (R.length !== m) throw new Error('dare: R must be m x m (m = number of columns of B)');

  const Rinv = inv(R);
  let Ak = A.map((row) => row.slice());
  let Gk = matmul(matmul(B, Rinv), transpose(B));
  let Hk = Q.map((row) => row.slice());

  for (let iter = 0; iter < RICCATI_MAX_ITER; iter++) {
    const I_GH_inv = inv(matadd(eye(n), matmul(Gk, Hk)));
    const AkT = transpose(Ak);
    const Ak_IGHinv = matmul(Ak, I_GH_inv);

    const Anew = matmul(Ak_IGHinv, Ak);
    const Gnew = matadd(Gk, matmul(matmul(Ak_IGHinv, Gk), AkT));
    const Hnew = matadd(Hk, matmul(matmul(AkT, matmul(Hk, I_GH_inv)), Ak));

    const diff = maxAbsDiff(Hnew, Hk);
    Ak = Anew;
    Gk = Gnew;
    Hk = Hnew;
    if (diff < RICCATI_TOL) break;
  }

  return symmetrize(Hk);
}
