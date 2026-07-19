/**
 * Iterative Krylov-subspace linear solvers.
 *
 * For the large sparse systems a dense factorization (`lusolve`, `qr`, …)
 * can't handle — none of these methods ever form or fill in `A`. Each solver
 * accepts either a dense matrix or a matvec callback (a "linear operator" in
 * the SciPy/Trilinos sense), plus an optional preconditioner:
 *
 * - `cg` — Conjugate Gradient, for symmetric positive-definite `A`.
 * - `minres` — MINRES, for symmetric (possibly indefinite) `A`.
 * - `gmres` — restarted GMRES, for general nonsymmetric `A`.
 * - `bicgstab` — BiCGSTAB, for general nonsymmetric `A`.
 *
 * @packageDocumentation
 */

/** A linear operator: either a dense matrix or a matvec callback `x -> A x`. */
export type LinearOperatorInput = number[][] | ((x: number[]) => number[]);

/**
 * Preconditioner. The three built-ins require a dense matrix (they read `A`'s
 * entries): `'jacobi'` (diagonal `M⁻¹ = diag(1/Aᵢᵢ)`), `'ilu'` (ILU(0) —
 * incomplete LU with zero fill on `A`'s sparsity pattern, for general `A`),
 * `'ic'` (IC(0) — incomplete Cholesky, for symmetric positive-definite `A`).
 * Or pass a custom `M⁻¹` callback (the only option that works with a
 * matvec-only operator).
 */
export type Preconditioner = 'jacobi' | 'ilu' | 'ic' | ((r: number[]) => number[]);

/** Common options accepted by every solver in this module. */
export interface KrylovOptions {
  /** Initial guess (default: the zero vector). */
  x0?: number[];
  /** Relative-residual convergence tolerance (default 1e-10). */
  tol?: number;
  /** Maximum iterations (default `min(10 * n, 1000)`). */
  maxIter?: number;
  /** Preconditioner: `'jacobi'` or a custom `(r) => M⁻¹r` callback. */
  preconditioner?: Preconditioner;
}

/** Options for {@link gmres}, adding the restart length. */
export interface GmresOptions extends KrylovOptions {
  /** Restart length (default 30). */
  restart?: number;
}

/** Result returned by every solver in this module. */
export interface KrylovResult {
  /** Approximate solution. */
  x: number[];
  /** Number of iterations performed. */
  iterations: number;
  /** Whether the relative residual dropped below `tol`. */
  converged: boolean;
  /** Final relative residual `‖b − A x‖₂ / ‖b‖₂`. */
  residual: number;
}

function isDenseMatrix(a: LinearOperatorInput): a is number[][] {
  return Array.isArray(a);
}

function toMatvec(a: LinearOperatorInput): (x: number[]) => number[] {
  if (!isDenseMatrix(a)) return a;
  const rows = a;
  return (x: number[]): number[] => {
    const n = rows.length;
    const y = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      const row = rows[i];
      let sum = 0;
      for (let j = 0; j < row.length; j++) sum += row[j] * x[j];
      y[i] = sum;
    }
    return y;
  };
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm2(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

function axpy(alpha: number, x: number[], y: number[]): number[] {
  const n = x.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = alpha * x[i] + y[i];
  return out;
}

function scale(alpha: number, x: number[]): number[] {
  return x.map((v) => alpha * v);
}

function subtract(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}

function add(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

/** Build the `M⁻¹` apply function from a `preconditioner` option. */
function resolvePreconditioner(
  a: LinearOperatorInput,
  preconditioner: Preconditioner | undefined
): (r: number[]) => number[] {
  if (preconditioner === undefined) return (r: number[]) => r.slice();
  if (typeof preconditioner === 'function') return preconditioner;
  if (!isDenseMatrix(a)) {
    throw new Error(
      `krylov: '${preconditioner}' preconditioner requires a dense matrix (it reads A's entries) — pass a custom preconditioner function when using a matvec operator`
    );
  }
  if (preconditioner === 'jacobi') return makeJacobi(a);
  if (preconditioner === 'ilu') return makeILU0(a);
  return makeIC0(a); // 'ic'
}

/** Jacobi (diagonal) preconditioner `M⁻¹ = diag(1/Aᵢᵢ)`. */
function makeJacobi(a: number[][]): (r: number[]) => number[] {
  const n = a.length;
  const invDiag = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const d = a[i][i];
    if (d === 0) {
      throw new Error(
        `krylov: Jacobi preconditioner requires a nonzero diagonal (A[${i}][${i}] = 0)`
      );
    }
    invDiag[i] = 1 / d;
  }
  return (r: number[]) => r.map((v, i) => v * invDiag[i]);
}

/** `true` where `A` is nonzero, always including the diagonal — the pattern ILU(0)/IC(0) preserve. */
function sparsityPattern(a: number[][]): boolean[][] {
  return a.map((row, i) => row.map((v, j) => v !== 0 || i === j));
}

/**
 * ILU(0) — incomplete LU factorization with zero fill. Returns unit-lower `L`
 * and upper `U` (dense, with zeros outside `A`'s sparsity pattern) such that
 * `(L·U)ᵢⱼ = Aᵢⱼ` on that pattern, dropping any fill that would arise outside
 * it. The classic preconditioner for iterative solvers on general sparse `A`.
 *
 * @example
 * incompleteLU([[4,1,0],[1,4,1],[0,1,4]]) // tridiagonal → exact LU (no fill)
 */
export function incompleteLU(a: readonly number[][]): { L: number[][]; U: number[][] } {
  const n = a.length;
  const pattern = sparsityPattern(a as number[][]);
  const LU = (a as number[][]).map((row) => row.slice());
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < i; k++) {
      if (!pattern[i][k]) continue;
      if (Math.abs(LU[k][k]) < 1e-300) {
        throw new Error(`incompleteLU: ILU(0) zero pivot at U[${k}][${k}] — matrix needs pivoting`);
      }
      const lik = LU[i][k] / LU[k][k];
      LU[i][k] = lik;
      for (let j = k + 1; j < n; j++) {
        if (!pattern[i][j]) continue;
        LU[i][j] -= lik * LU[k][j];
      }
    }
    if (Math.abs(LU[i][i]) < 1e-300) {
      throw new Error(`incompleteLU: ILU(0) zero pivot at U[${i}][${i}] — matrix needs pivoting`);
    }
  }
  const L: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (j < i ? LU[i][j] : j === i ? 1 : 0))
  );
  const U: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (j >= i ? LU[i][j] : 0))
  );
  return { L, U };
}

/**
 * IC(0) — incomplete Cholesky factorization with zero fill, for symmetric
 * positive-definite `A`. Returns lower-triangular `L` on `A`'s sparsity pattern
 * with `(L·Lᵀ)ᵢⱼ = Aᵢⱼ` there. Throws on a non-positive pivot (the `A`-is-SPD
 * precondition failed).
 *
 * @example
 * incompleteCholesky([[4,1,0],[1,4,1],[0,1,4]]) // tridiagonal → exact Cholesky
 */
export function incompleteCholesky(a: readonly number[][]): { L: number[][] } {
  const n = a.length;
  const src = a as number[][];
  const pattern = sparsityPattern(src);
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      if (!pattern[i][j]) continue;
      let sum = src[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        if (sum <= 0) {
          throw new Error(
            `incompleteCholesky: IC(0) requires a symmetric positive-definite matrix (non-positive pivot ${sum} at ${i}) — use ILU(0) for indefinite/nonsymmetric A`
          );
        }
        L[i][i] = Math.sqrt(sum);
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }
  return { L };
}

/** ILU(0) preconditioner apply `M⁻¹r = U⁻¹(L⁻¹r)` (unit-lower `L`, upper `U`). */
function makeILU0(a: number[][]): (r: number[]) => number[] {
  const { L, U } = incompleteLU(a);
  const n = a.length;
  return (r: number[]) => {
    const y = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = r[i];
      for (let j = 0; j < i; j++) s -= L[i][j] * y[j];
      y[i] = s; // L has unit diagonal
    }
    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j < n; j++) s -= U[i][j] * x[j];
      x[i] = s / U[i][i];
    }
    return x;
  };
}

/** IC(0) preconditioner apply `M⁻¹r = L⁻ᵀ(L⁻¹r)` (lower `L`, `M = L·Lᵀ`). */
function makeIC0(a: number[][]): (r: number[]) => number[] {
  const { L } = incompleteCholesky(a);
  const n = a.length;
  return (r: number[]) => {
    const y = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = r[i];
      for (let j = 0; j < i; j++) s -= L[i][j] * y[j];
      y[i] = s / L[i][i];
    }
    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j < n; j++) s -= L[j][i] * x[j];
      x[i] = s / L[i][i];
    }
    return x;
  };
}

function defaultMaxIter(n: number): number {
  return Math.min(n * 10, 1000);
}

function relativeResidualNorm(rNorm: number, bNorm: number): number {
  return bNorm > 0 ? rNorm / bNorm : rNorm;
}

function relativeResidual(
  matvec: (x: number[]) => number[],
  x: number[],
  b: number[],
  bNorm: number
): number {
  return relativeResidualNorm(norm2(subtract(b, matvec(x))), bNorm);
}

/**
 * Conjugate Gradient (CG) — for symmetric positive-definite `A`.
 *
 * @example
 * cg([[4, 1], [1, 3]], [1, 2]) // => { x: [1/11, 7/11], converged: true, ... }
 */
export function cg(a: LinearOperatorInput, b: number[], opts?: KrylovOptions): KrylovResult {
  const n = b.length;
  const matvec = toMatvec(a);
  const applyM = resolvePreconditioner(a, opts?.preconditioner);
  const tol = opts?.tol ?? 1e-10;
  const maxIter = opts?.maxIter ?? defaultMaxIter(n);
  const bNorm = norm2(b);

  let x = opts?.x0 ? opts.x0.slice() : zeros(n);
  let r = subtract(b, matvec(x));
  let z = applyM(r);
  let p = z.slice();
  let rzOld = dot(r, z);

  let residual = relativeResidualNorm(norm2(r), bNorm);
  if (residual < tol) {
    return { x, iterations: 0, converged: true, residual };
  }

  let iterations = 0;
  for (let iter = 1; iter <= maxIter; iter++) {
    iterations = iter;
    const Ap = matvec(p);
    const pAp = dot(p, Ap);
    if (Math.abs(pAp) < 1e-300) break;
    const alpha = rzOld / pAp;
    x = axpy(alpha, p, x);
    r = axpy(-alpha, Ap, r);
    residual = relativeResidualNorm(norm2(r), bNorm);
    if (residual < tol) {
      return { x, iterations, converged: true, residual };
    }
    z = applyM(r);
    const rzNew = dot(r, z);
    const beta = rzNew / rzOld;
    p = add(z, scale(beta, p));
    rzOld = rzNew;
  }

  return { x, iterations, converged: residual < tol, residual };
}

/**
 * MINRES — for symmetric (possibly indefinite) `A`.
 *
 * The Paige–Saunders short-recurrence MINRES (Paige & Saunders 1975): a
 * preconditioned Lanczos tridiagonalization coupled with an incrementally
 * updated Givens-rotation QR of the tridiagonal. Each iteration does a fixed
 * number of length-`n` vector operations (one matvec + a handful of `axpy`s)
 * and **O(1)** scalar work — no growing least-squares is ever formed or
 * solved. The solution is advanced through a running 3-term `w`-recurrence, so
 * the whole solve is **O(k·n)** for `k` iterations rather than the O(k³) of the
 * former "re-solve the growing `(k+1)×k` tridiagonal each step" formulation.
 *
 * With a preconditioner `M`, the loop converges the `M⁻¹`-norm relative
 * residual `‖r_k‖_{M⁻¹} / ‖r_0‖_{M⁻¹}` (the estimate MINRES minimizes); for
 * `M = I` this equals `‖b − A x‖₂ / ‖b‖₂`. The reported `residual`/`converged`
 * are always computed from the true Euclidean residual (one final matvec).
 *
 * @example
 * minres([[0, 1], [1, 0]], [1, 2]) // => { x: [2, 1], converged: true, ... }
 */
export function minres(a: LinearOperatorInput, b: number[], opts?: KrylovOptions): KrylovResult {
  const n = b.length;
  const matvec = toMatvec(a);
  const applyM = resolvePreconditioner(a, opts?.preconditioner);
  const tol = opts?.tol ?? 1e-10;
  const maxIter = opts?.maxIter ?? defaultMaxIter(n);
  const bNorm = norm2(b);

  const x = opts?.x0 ? opts.x0.slice() : zeros(n);

  // r1 = b - A x, y = M^-1 r1, beta1 = <r1, M^-1 r1>^(1/2)
  let r1 = subtract(b, matvec(x));
  let y = applyM(r1);
  const beta1 = Math.sqrt(Math.max(0, dot(r1, y)));

  const residual0 = relativeResidualNorm(norm2(r1), bNorm);
  if (residual0 < tol || beta1 < 1e-300) {
    return { x, iterations: 0, converged: residual0 < tol, residual: residual0 };
  }

  // Paige-Saunders scalar recurrences (Lanczos + Givens on the tridiagonal).
  let oldb = 0;
  let beta = beta1;
  let dbar = 0;
  let epsln = 0;
  let phibar = beta1;
  let cs = -1;
  let sn = 0;
  let w = zeros(n);
  let w2 = zeros(n);
  let r2 = r1.slice();

  let iterations = 0;
  for (let iter = 1; iter <= maxIter; iter++) {
    iterations = iter;

    // Next Lanczos vector v = y / beta, then y = A v - (beta/oldb) r1 - (alfa/beta) r2.
    const v = scale(1 / beta, y);
    y = matvec(v);
    if (iter >= 2) y = axpy(-beta / oldb, r1, y);
    const alfa = dot(v, y);
    y = axpy(-alfa / beta, r2, y);
    r1 = r2;
    r2 = y;
    y = applyM(r2);
    oldb = beta;
    beta = Math.sqrt(Math.max(0, dot(r2, y)));

    // Apply the previous Givens rotation Q_{k-1} to the new tridiagonal column.
    const oldeps = epsln;
    const delta = cs * dbar + sn * alfa;
    const gbar = sn * dbar - cs * alfa;
    epsln = sn * beta;
    dbar = -cs * beta;

    // Compute the next Givens rotation Q_k that eliminates beta.
    const gamma = Math.max(Math.sqrt(gbar * gbar + beta * beta), 1e-300);
    cs = gbar / gamma;
    sn = beta / gamma;
    const phi = cs * phibar;
    phibar = sn * phibar;

    // Advance the solution via the 3-term w-recurrence: w = (v - oldeps w1 - delta w2)/gamma.
    const w1 = w2;
    w2 = w;
    w = scale(1 / gamma, subtract(subtract(v, scale(oldeps, w1)), scale(delta, w2)));
    for (let i = 0; i < n; i++) x[i] += phi * w[i];

    // phibar = ‖r_k‖_{M⁻¹}; gate on the relative preconditioned residual.
    if (phibar / beta1 < tol || beta < 1e-300) break;
  }

  const residual = relativeResidual(matvec, x, b, bNorm);
  return { x, iterations, converged: residual < tol, residual };
}

/**
 * Restarted GMRES — for general nonsymmetric `A`.
 *
 * @example
 * gmres([[3, 1], [0, 2]], [4, 2]) // => { x: [1, 1], converged: true, ... }
 */
export function gmres(a: LinearOperatorInput, b: number[], opts?: GmresOptions): KrylovResult {
  const n = b.length;
  const matvec = toMatvec(a);
  const applyM = resolvePreconditioner(a, opts?.preconditioner);
  const tol = opts?.tol ?? 1e-10;
  const maxIter = opts?.maxIter ?? defaultMaxIter(n);
  const restart = Math.max(1, Math.min(opts?.restart ?? 30, n));
  const bNorm = norm2(b);

  let x = opts?.x0 ? opts.x0.slice() : zeros(n);
  let totalIterations = 0;
  let residual = relativeResidual(matvec, x, b, bNorm);
  if (residual < tol) {
    return { x, iterations: 0, converged: true, residual };
  }

  while (totalIterations < maxIter) {
    const r0 = applyM(subtract(b, matvec(x)));
    const beta = norm2(r0);
    if (beta < 1e-300) {
      return { x, iterations: totalIterations, converged: residual < tol, residual };
    }

    const m = Math.min(restart, maxIter - totalIterations);
    const V: number[][] = [scale(1 / beta, r0)];
    const H: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(m).fill(0));
    const g = new Array<number>(m + 1).fill(0);
    g[0] = beta;
    const cs = new Array<number>(m).fill(0);
    const sn = new Array<number>(m).fill(0);

    let k = 0;
    for (; k < m; k++) {
      totalIterations++;
      let w = applyM(matvec(V[k]));
      for (let i = 0; i <= k; i++) {
        H[i][k] = dot(w, V[i]);
        w = axpy(-H[i][k], V[i], w);
      }
      H[k + 1][k] = norm2(w);
      V.push(H[k + 1][k] > 1e-300 ? scale(1 / H[k + 1][k], w) : zeros(n));

      // Apply previous Givens rotations to the new column of H.
      for (let i = 0; i < k; i++) {
        const temp = cs[i] * H[i][k] + sn[i] * H[i + 1][k];
        H[i + 1][k] = -sn[i] * H[i][k] + cs[i] * H[i + 1][k];
        H[i][k] = temp;
      }

      // Compute and apply the new Givens rotation to eliminate H[k+1][k].
      const denom = Math.sqrt(H[k][k] * H[k][k] + H[k + 1][k] * H[k + 1][k]);
      if (denom < 1e-300) {
        cs[k] = 1;
        sn[k] = 0;
      } else {
        cs[k] = H[k][k] / denom;
        sn[k] = H[k + 1][k] / denom;
      }
      H[k][k] = cs[k] * H[k][k] + sn[k] * H[k + 1][k];
      H[k + 1][k] = 0;

      const temp = cs[k] * g[k] + sn[k] * g[k + 1];
      g[k + 1] = -sn[k] * g[k] + cs[k] * g[k + 1];
      g[k] = temp;

      residual = relativeResidualNorm(Math.abs(g[k + 1]), bNorm);
      if (residual < tol) {
        k++;
        break;
      }
    }

    // Solve the upper-triangular system H[0..k-1][0..k-1] y = g[0..k-1].
    const y = new Array<number>(k).fill(0);
    for (let i = k - 1; i >= 0; i--) {
      let sum = g[i];
      for (let j = i + 1; j < k; j++) sum -= H[i][j] * y[j];
      y[i] = Math.abs(H[i][i]) > 1e-300 ? sum / H[i][i] : 0;
    }

    for (let i = 0; i < k; i++) {
      x = axpy(y[i], V[i], x);
    }

    residual = relativeResidual(matvec, x, b, bNorm);
    if (residual < tol || k < m) {
      return { x, iterations: totalIterations, converged: residual < tol, residual };
    }
  }

  return { x, iterations: totalIterations, converged: residual < tol, residual };
}

/**
 * BiCGSTAB — for general nonsymmetric `A`.
 *
 * @example
 * bicgstab([[3, 1], [0, 2]], [4, 2]) // => { x: [1, 1], converged: true, ... }
 */
export function bicgstab(a: LinearOperatorInput, b: number[], opts?: KrylovOptions): KrylovResult {
  const n = b.length;
  const matvec = toMatvec(a);
  const applyM = resolvePreconditioner(a, opts?.preconditioner);
  const tol = opts?.tol ?? 1e-10;
  const maxIter = opts?.maxIter ?? defaultMaxIter(n);
  const bNorm = norm2(b);

  let x = opts?.x0 ? opts.x0.slice() : zeros(n);
  let r = subtract(b, matvec(x));
  const rHat0 = r.slice();

  let residual = relativeResidualNorm(norm2(r), bNorm);
  if (residual < tol) {
    return { x, iterations: 0, converged: true, residual };
  }

  let rho = 1;
  let alpha = 1;
  let omega = 1;
  let v = zeros(n);
  let p = zeros(n);

  let iterations = 0;
  for (let iter = 1; iter <= maxIter; iter++) {
    iterations = iter;
    const rhoNew = dot(rHat0, r);
    if (Math.abs(rhoNew) < 1e-300) break;

    if (iter === 1) {
      p = r.slice();
    } else {
      const beta = (rhoNew / rho) * (alpha / omega);
      p = add(r, scale(beta, subtract(p, scale(omega, v))));
    }
    rho = rhoNew;

    const pHat = applyM(p);
    v = matvec(pHat);
    const rHatV = dot(rHat0, v);
    if (Math.abs(rHatV) < 1e-300) break;
    alpha = rho / rHatV;

    const s = axpy(-alpha, v, r);
    const sNorm = relativeResidualNorm(norm2(s), bNorm);
    if (sNorm < tol) {
      x = axpy(alpha, pHat, x);
      residual = sNorm;
      return { x, iterations, converged: true, residual };
    }

    const sHat = applyM(s);
    const t = matvec(sHat);
    const tt = dot(t, t);
    omega = tt > 1e-300 ? dot(t, s) / tt : 0;

    x = axpy(alpha, pHat, x);
    x = axpy(omega, sHat, x);
    r = axpy(-omega, t, s);

    residual = relativeResidualNorm(norm2(r), bNorm);
    if (residual < tol) {
      return { x, iterations, converged: true, residual };
    }

    if (Math.abs(omega) < 1e-300) break;
  }

  return { x, iterations, converged: residual < tol, residual };
}
