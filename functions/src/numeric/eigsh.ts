/**
 * Iterative symmetric eigensolver — Lanczos tridiagonalization + Rayleigh-Ritz.
 *
 * For large symmetric problems where the dense `eigs` (full O(n^3)
 * eigendecomposition of the whole matrix) is prohibitive, `eigsh` extracts
 * just the `k` largest or smallest eigenpairs. It builds an orthonormal
 * Krylov basis `V` via the Lanczos iteration (with full reorthogonalization
 * against every prior Lanczos vector, for numerical stability at the small
 * sizes this is exercised at), forming the small tridiagonal projection
 * `T = Vᵀ A V`. `T`'s eigenproblem is solved directly (cyclic Jacobi
 * rotations — `T` is dense-symmetric-small by construction) and lifted back
 * through `V` (Rayleigh-Ritz) to approximate `A`'s eigenpairs. Accepts either
 * a dense matrix or a matvec callback (a linear operator, matching the
 * `krylov.ts` convention) — the matvec form never forms `A` and requires
 * `opts.n` since the dimension can't otherwise be inferred.
 *
 * @packageDocumentation
 */

/** A symmetric linear operator: either a dense matrix or a matvec callback `x -> A x`. */
export type EigshOperatorInput = number[][] | ((x: number[]) => number[]);

/** Options accepted by {@link eigsh}. */
export interface EigshOptions {
  /** Which end of the spectrum to return: `'LM'` (largest, default) or `'SM'` (smallest). */
  which?: 'LM' | 'SM';
  /** Dimension of `A` — required when `A` is a matvec callback. */
  n?: number;
  /** Convergence tolerance for diagonalizing the small tridiagonal projection (default 1e-10). */
  tol?: number;
  /** Maximum Lanczos steps (default `min(max(2k + 20, 20), n)`). */
  maxIter?: number;
}

/**
 * Result of {@link eigsh}.
 *
 * `eigenvectors` is an `n x k` matrix with eigenvectors stored as **columns**:
 * `eigenvectors[i][j]` is the `i`-th component of the `j`-th eigenvector,
 * which corresponds to `eigenvalues[j]`.
 */
export interface EigshResult {
  /** The `k` selected eigenvalues, ordered by `which` (largest-first for `'LM'`, smallest-first for `'SM'`). */
  eigenvalues: number[];
  /** The `k` corresponding eigenvectors, as columns of an `n x k` matrix. */
  eigenvectors: number[][];
}

function isDenseMatrix(a: EigshOperatorInput): a is number[][] {
  return Array.isArray(a);
}

/** Resolve `A` (dense or matvec) into a matvec callback plus the problem dimension. */
function toMatvecAndSize(
  a: EigshOperatorInput,
  nOpt: number | undefined
): { matvec: (x: number[]) => number[]; n: number } {
  if (isDenseMatrix(a)) {
    const rows = a;
    const n = rows.length;
    if (n === 0 || rows.some((row) => row.length !== n)) {
      throw new Error('eigsh: dense matrix input must be square and non-empty');
    }
    return {
      n,
      matvec: (x: number[]): number[] =>
        rows.map((row) => row.reduce((s, v, j) => s + v * x[j], 0)),
    };
  }
  if (nOpt === undefined) {
    throw new Error(
      'eigsh: a matvec operator requires opts.n (the matrix dimension) since it cannot be inferred from a function'
    );
  }
  return { matvec: a, n: nOpt };
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm2(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

/** `alpha * x + y` (does not mutate `x`/`y`). */
function axpy(alpha: number, x: number[], y: number[]): number[] {
  const out = new Array<number>(x.length);
  for (let i = 0; i < x.length; i++) out[i] = alpha * x[i] + y[i];
  return out;
}

function scale(alpha: number, x: number[]): number[] {
  return x.map((v) => alpha * v);
}

/** Deterministic unit-norm starting vector (no `Math.random`): `v[i] = sin(i + 1)`. */
function startVector(n: number): number[] {
  const v = new Array<number>(n);
  for (let i = 0; i < n; i++) v[i] = Math.sin(i + 1);
  const nrm = norm2(v);
  return nrm > 1e-300 ? scale(1 / nrm, v) : v.map((_, i) => (i === 0 ? 1 : 0));
}

/** Lanczos tridiagonalization with full reorthogonalization. */
function lanczos(
  matvec: (x: number[]) => number[],
  n: number,
  m: number
): { V: number[][]; alphas: number[]; betas: number[] } {
  const V: number[][] = [startVector(n)];
  const alphas: number[] = [];
  const betas: number[] = [];

  for (let j = 0; j < m; j++) {
    const vj = V[j];
    let w = matvec(vj);
    if (j > 0) w = axpy(-betas[j - 1], V[j - 1], w);
    const alpha = dot(w, vj);
    alphas.push(alpha);
    w = axpy(-alpha, vj, w);

    // Full reorthogonalization against every prior Lanczos vector (two passes
    // for numerical stability — classical Gram-Schmidt loses orthogonality
    // fast without it).
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i <= j; i++) {
        const c = dot(w, V[i]);
        w = axpy(-c, V[i], w);
      }
    }

    const beta = norm2(w);
    if (j === m - 1 || beta < 1e-13) break; // done, or lucky breakdown (invariant subspace found)
    betas.push(beta);
    V.push(scale(1 / beta, w));
  }

  return { V, alphas, betas };
}

/**
 * Cyclic Jacobi eigenvalue algorithm for a small dense symmetric matrix.
 * Returns eigenvalues plus eigenvectors as columns of a dense matrix.
 */
function jacobiEigenSymmetric(
  input: number[][],
  tol: number
): { values: number[]; vectors: number[][] } {
  const n = input.length;
  const a = input.map((row) => row.slice());
  const v: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  const maxSweeps = 100;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let offDiagSumSq = 0;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) offDiagSumSq += a[p][q] * a[p][q];
    }
    if (offDiagSumSq < tol * tol) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p][q];
        if (Math.abs(apq) < 1e-300) continue;

        const theta = (a[q][q] - a[p][p]) / (2 * apq);
        const sign = theta === 0 ? 1 : Math.sign(theta);
        const t = sign / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        const app = a[p][p];
        const aqq = a[q][q];
        a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
        a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
        a[p][q] = 0;
        a[q][p] = 0;

        for (let i = 0; i < n; i++) {
          if (i === p || i === q) continue;
          const aip = a[i][p];
          const aiq = a[i][q];
          a[i][p] = c * aip - s * aiq;
          a[p][i] = a[i][p];
          a[i][q] = s * aip + c * aiq;
          a[q][i] = a[i][q];
        }

        for (let i = 0; i < n; i++) {
          const vip = v[i][p];
          const viq = v[i][q];
          v[i][p] = c * vip - s * viq;
          v[i][q] = s * vip + c * viq;
        }
      }
    }
  }

  const values = new Array<number>(n);
  for (let i = 0; i < n; i++) values[i] = a[i][i];
  return { values, vectors: v };
}

/**
 * `eigsh` — the `k` largest or smallest eigenpairs of a **symmetric** matrix
 * via the Lanczos iteration, for problems too large for the dense `eigs`.
 *
 * `A` may be a dense `number[][]` or a matvec callback `x => A x` (in which
 * case `opts.n` is required — the dimension can't be inferred from a
 * function). Eigenvectors are returned as **columns** of an `n x k` matrix:
 * `result.eigenvectors[i][j]` is the `i`-th component of the eigenvector for
 * `result.eigenvalues[j]`.
 *
 * @example
 * eigsh([[2, 1, 0], [1, 2, 1], [0, 1, 2]], 1, { which: 'LM' })
 * // => { eigenvalues: [2 + Math.SQRT2], eigenvectors: [[...]] }
 */
export function eigsh(a: EigshOperatorInput, k = 1, opts?: EigshOptions): EigshResult {
  const which = opts?.which ?? 'LM';
  const { matvec, n } = toMatvecAndSize(a, opts?.n);

  if (!Number.isInteger(k) || k < 1 || k > n) {
    throw new Error(`eigsh: k must be an integer between 1 and n (n=${n}), got ${k}`);
  }

  const tol = opts?.tol ?? 1e-10;
  const m = Math.min(opts?.maxIter ?? Math.max(2 * k + 20, 20), n);

  const { V, alphas, betas } = lanczos(matvec, n, m);
  const size = alphas.length;
  if (k > size) {
    throw new Error(
      `eigsh: Lanczos basis collapsed to ${size} vectors (invariant subspace) before ${k} eigenpairs could be extracted`
    );
  }

  // Build the small dense tridiagonal projection T (diag = alphas, off-diag = betas).
  const T: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  for (let i = 0; i < size; i++) {
    T[i][i] = alphas[i];
    if (i + 1 < size) {
      T[i][i + 1] = betas[i];
      T[i + 1][i] = betas[i];
    }
  }

  const { values, vectors } = jacobiEigenSymmetric(T, tol);

  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a1, b1) => (which === 'LM' ? b1.value - a1.value : a1.value - b1.value));

  const eigenvalues = order.slice(0, k).map((o) => o.value);
  const eigenvectors: number[][] = Array.from({ length: n }, () => new Array<number>(k).fill(0));

  for (let col = 0; col < k; col++) {
    const ritzIndex = order[col].index;
    // Lift the Ritz vector (T's eigenvector) back through the Lanczos basis V.
    let full = new Array<number>(n).fill(0);
    for (let i = 0; i < size; i++) {
      full = axpy(vectors[i][ritzIndex], V[i], full);
    }
    const nrm = norm2(full);
    if (nrm > 1e-300) full = scale(1 / nrm, full);
    for (let row = 0; row < n; row++) eigenvectors[row][col] = full[row];
  }

  return { eigenvalues, eigenvectors };
}
