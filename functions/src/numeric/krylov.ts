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

/** Preconditioner: `'jacobi'` (diagonal, dense-matrix only) or a custom `M⁻¹` callback. */
export type Preconditioner = 'jacobi' | ((r: number[]) => number[]);

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
  // 'jacobi'
  if (!isDenseMatrix(a)) {
    throw new Error(
      "krylov: 'jacobi' preconditioner requires a dense matrix (need the diagonal) — pass a custom preconditioner function when using a matvec operator"
    );
  }
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
 * Builds the preconditioned Lanczos tridiagonalization of `A` and, at each
 * step, solves the growing `(k+1) x k` tridiagonal least-squares problem
 * `min ||beta1 e1 - T_k y||` via a small dense Householder QR. This is the
 * textbook MINRES minimization restated directly (rather than the
 * incrementally-updated Givens-rotation form), which keeps it simple to
 * verify against a closed-form oracle at the cost of some redundant work
 * per iteration — acceptable since `maxIter` is bounded by `min(10n, 1000)`.
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

  const x0 = opts?.x0 ? opts.x0.slice() : zeros(n);
  const r0 = subtract(b, matvec(x0));

  let residual = relativeResidualNorm(norm2(r0), bNorm);
  if (residual < tol) {
    return { x: x0, iterations: 0, converged: true, residual };
  }

  const z0 = applyM(r0);
  const beta1 = Math.sqrt(dot(r0, z0));
  if (beta1 < 1e-300) {
    return { x: x0, iterations: 0, converged: residual < tol, residual };
  }

  // V[k] = k-th Lanczos vector, Z[k] = M^-1 V[k] (both 1-indexed; index 0 is
  // an unused zero-padding entry so V[k]/Z[k] line up with the math below).
  const V: number[][] = [zeros(n), scale(1 / beta1, r0)];
  const Z: number[][] = [zeros(n), scale(1 / beta1, z0)];
  const alphas: number[] = [];
  const betas: number[] = [beta1]; // betas[k-1] = beta_k (the sub/super-diagonal entry feeding into step k)

  let bestX = x0.slice();
  let bestResidual = residual;
  let iterations = 0;

  for (let k = 1; k <= maxIter; k++) {
    iterations = k;
    const vK = V[k];
    const zK = Z[k];
    const vKm1 = V[k - 1];
    const betaK = betas[k - 1];

    let p = matvec(zK);
    p = subtract(p, scale(betaK, vKm1));
    const alphaK = dot(p, zK);
    alphas.push(alphaK);
    p = subtract(p, scale(alphaK, vK));

    const zRaw = applyM(p);
    const betaNext = Math.sqrt(Math.max(0, dot(p, zRaw)));

    // Tridiagonal T_k is (k+1) x k: diag = alphas, off-diag = betas[1..k-1],
    // plus the trailing betaNext row.
    const T: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(k).fill(0));
    for (let i = 0; i < k; i++) {
      T[i][i] = alphas[i];
      if (i + 1 < k) {
        T[i + 1][i] = betas[i + 1];
        T[i][i + 1] = betas[i + 1];
      }
    }
    T[k][k - 1] = betaNext;

    const rhs = new Array<number>(k + 1).fill(0);
    rhs[0] = beta1;

    const y = solveLeastSquaresQR(T, rhs);

    let xCandidate = x0.slice();
    for (let i = 0; i < k; i++) {
      xCandidate = axpy(y[i], Z[i + 1], xCandidate);
    }

    residual = relativeResidual(matvec, xCandidate, b, bNorm);
    if (residual < bestResidual) {
      bestResidual = residual;
      bestX = xCandidate;
    }

    if (residual < tol) {
      return { x: xCandidate, iterations: k, converged: true, residual };
    }

    if (betaNext < 1e-300) break;

    betas.push(betaNext);
    V.push(scale(1 / betaNext, p));
    Z.push(scale(1 / betaNext, zRaw));
  }

  return { x: bestX, iterations, converged: bestResidual < tol, residual: bestResidual };
}

/** Solve a small dense least-squares problem `min ||rhs - T y||` via Householder QR. */
function solveLeastSquaresQR(T: number[][], rhs: number[]): number[] {
  const m = T.length;
  const n = T[0]?.length ?? 0;
  const R: number[][] = T.map((row) => row.slice());
  const c = rhs.slice();

  for (let k = 0; k < n; k++) {
    let normX = 0;
    for (let i = k; i < m; i++) normX += R[i][k] * R[i][k];
    normX = Math.sqrt(normX);
    if (normX < 1e-300) continue;

    const alpha = R[k][k] >= 0 ? -normX : normX;
    const v = new Array<number>(m).fill(0);
    v[k] = R[k][k] - alpha;
    for (let i = k + 1; i < m; i++) v[i] = R[i][k];

    let vNormSq = 0;
    for (let i = k; i < m; i++) vNormSq += v[i] * v[i];
    if (vNormSq < 1e-300) continue;

    for (let j = k; j < n; j++) {
      let dotVR = 0;
      for (let i = k; i < m; i++) dotVR += v[i] * R[i][j];
      const factor = (2 * dotVR) / vNormSq;
      for (let i = k; i < m; i++) R[i][j] -= factor * v[i];
    }

    let dotVC = 0;
    for (let i = k; i < m; i++) dotVC += v[i] * c[i];
    const factorC = (2 * dotVC) / vNormSq;
    for (let i = k; i < m; i++) c[i] -= factorC * v[i];
  }

  const y = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = c[i];
    for (let j = i + 1; j < n; j++) sum -= R[i][j] * y[j];
    y[i] = Math.abs(R[i][i]) > 1e-300 ? sum / R[i][i] : 0;
  }
  return y;
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
