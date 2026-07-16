/**
 * Complex matrix functions — `funm`/`cosm`/`sinm` for a general real matrix.
 *
 * `funm(A, f)` evaluates a scalar analytic function `f` at a square matrix
 * `A`, returning the complex matrix `f(A)`. Unlike `sqrtm`/`matrixLogm`
 * (which only handle real matrices whose spectrum stays on the principal
 * branch — positive reals for sqrt/log), `funm` accepts any real spectrum
 * (negative, complex-conjugate pairs, …) because the result is allowed to be
 * complex-valued.
 *
 * Algorithm (diagonalizable matrices with distinct eigenvalues):
 *   - If `A` is diagonal, `f(A)` is exact and trivial: apply `f` to each
 *     diagonal entry (handles repeated eigenvalues fine, since a diagonal
 *     matrix is always diagonalizable regardless of eigenvalue multiplicity).
 *   - Otherwise, compute `A`'s eigenvalues `λ_1, …, λ_n` (via the shared
 *     `@danielsimonjr/mathts-matrix` `eig` — Householder + Francis QR) and,
 *     when they are all distinct, apply the Lagrange-Sylvester interpolation
 *     formula for a diagonalizable matrix with simple spectrum:
 *
 *       f(A) = Σ_i f(λ_i) · L_i(A),   L_i(A) = Π_{j≠i} (A − λ_j I) / (λ_i − λ_j)
 *
 *     evaluated in complex arithmetic (`A` embedded with zero imaginary
 *     part). This needs only eigenvalues, not eigenvectors, and is exact for
 *     any polynomial or entire function `f` (cos, sin, sqrt, exp, log, …)
 *     whenever the spectrum is simple.
 *
 * Limitation (documented, not yet implemented): matrices with repeated (or
 * numerically indistinguishable) eigenvalues that are NOT diagonal — i.e.
 * genuinely defective/non-diagonalizable matrices, or diagonalizable
 * matrices with a repeated eigenvalue and off-diagonal structure — are not
 * supported; `funm` throws rather than silently return a wrong answer. A
 * full Schur-Parlett block recurrence (Higham 2008 Ch. 9) would lift this
 * restriction; that is future work, not required by the current call sites.
 *
 * @packageDocumentation
 */

import { eig } from '@danielsimonjr/mathts-matrix';

/** A complex number as a plain `{re, im}` pair. */
export interface ComplexValue {
  re: number;
  im: number;
}

/** A complex-valued dense matrix, stored as parallel real/imaginary 2-D arrays. */
export interface ComplexMatrix {
  re: number[][];
  im: number[][];
}

/** A scalar analytic function to be applied to a matrix's spectrum. */
export type ScalarComplexFunction = (z: ComplexValue) => ComplexValue;

// ---------------------------------------------------------------------------
// Complex scalar / matrix arithmetic helpers
// ---------------------------------------------------------------------------

function cSub(a: ComplexValue, b: ComplexValue): ComplexValue {
  return { re: a.re - b.re, im: a.im - b.im };
}

function cMul(a: ComplexValue, b: ComplexValue): ComplexValue {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function cDiv(a: ComplexValue, b: ComplexValue): ComplexValue {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

function cAbs(a: ComplexValue): number {
  return Math.hypot(a.re, a.im);
}

/** Zero-fill an n x n complex matrix. */
function cZeros(n: number): ComplexMatrix {
  return {
    re: Array.from({ length: n }, () => new Array(n).fill(0)),
    im: Array.from({ length: n }, () => new Array(n).fill(0)),
  };
}

/** Embed a real matrix as a complex matrix (zero imaginary part). */
function cFromReal(A: number[][]): ComplexMatrix {
  const n = A.length;
  return {
    re: A.map((row) => row.slice()),
    im: Array.from({ length: n }, () => new Array(n).fill(0)),
  };
}

/** `A - lambda * I` for a real matrix `A` and complex scalar `lambda`. */
function cShiftedReal(A: number[][], lambda: ComplexValue): ComplexMatrix {
  const n = A.length;
  const re: number[][] = A.map((row) => row.slice());
  const im: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    re[i][i] -= lambda.re;
    im[i][i] -= lambda.im;
  }
  return { re, im };
}

/** Complex matrix multiply. */
function cMatMul(X: ComplexMatrix, Y: ComplexMatrix): ComplexMatrix {
  const n = X.re.length;
  const out = cZeros(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const xr = X.re[i][k];
      const xi = X.im[i][k];
      if (xr === 0 && xi === 0) continue;
      for (let j = 0; j < n; j++) {
        const yr = Y.re[k][j];
        const yi = Y.im[k][j];
        out.re[i][j] += xr * yr - xi * yi;
        out.im[i][j] += xr * yi + xi * yr;
      }
    }
  }
  return out;
}

/** Divide every entry of a complex matrix by a complex scalar. */
function cMatScalarDiv(X: ComplexMatrix, s: ComplexValue): ComplexMatrix {
  const n = X.re.length;
  const out = cZeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const q = cDiv({ re: X.re[i][j], im: X.im[i][j] }, s);
      out.re[i][j] = q.re;
      out.im[i][j] = q.im;
    }
  }
  return out;
}

/** `F += s * M` (complex scalar times complex matrix, accumulated in place). */
function cAccumulate(F: ComplexMatrix, s: ComplexValue, M: ComplexMatrix): void {
  const n = F.re.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const term = cMul(s, { re: M.re[i][j], im: M.im[i][j] });
      F.re[i][j] += term.re;
      F.im[i][j] += term.im;
    }
  }
}

// ---------------------------------------------------------------------------
// funm
// ---------------------------------------------------------------------------

/** Absolute tolerance (relative to the largest eigenvalue magnitude) for
 * treating two eigenvalues as "the same" — below this, the Lagrange-Sylvester
 * formula's `(λ_i - λ_j)` denominator is considered singular. */
const EIGENVALUE_DISTINCT_REL_TOL = 1e-8;

function isDiagonal(A: number[][], n: number): boolean {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && A[i][j] !== 0) return false;
    }
  }
  return true;
}

/**
 * Evaluate the matrix function `f(A)` for a square real matrix `A`, returning
 * a complex matrix `{re, im}`.
 *
 * Supports diagonal matrices unconditionally (exact, elementwise), and
 * general diagonalizable matrices whose eigenvalues are pairwise distinct
 * (Lagrange-Sylvester interpolation on the spectrum — see module docs).
 * Throws for matrices with repeated or numerically indistinguishable
 * eigenvalues that are not diagonal (defective / non-diagonalizable case;
 * not yet supported — see module docs for the Schur-Parlett follow-up).
 *
 * @param A - Square real matrix, as a plain 2-D array.
 * @param f - Scalar function to apply to each eigenvalue, e.g. `cos`, `sin`,
 *   `sqrt`, `exp`, `log`, extended to complex arguments.
 * @returns `{ re, im }` — the (possibly complex) matrix `f(A)`.
 */
export function funm(A: number[][], f: ScalarComplexFunction): ComplexMatrix {
  const n = A.length;
  if (n === 0) return { re: [], im: [] };
  for (const row of A) {
    if (row.length !== n) throw new Error(`funm: matrix must be square (got ${n}x${row.length})`);
  }

  if (isDiagonal(A, n)) {
    const out = cZeros(n);
    for (let i = 0; i < n; i++) {
      const fi = f({ re: A[i][i], im: 0 });
      out.re[i][i] = fi.re;
      out.im[i][i] = fi.im;
    }
    return out;
  }

  const { values } = eig(A, { computeVectors: false });

  const maxAbs = values.reduce((m, v) => Math.max(m, cAbs(v)), 0);
  const tol = EIGENVALUE_DISTINCT_REL_TOL * Math.max(1, maxAbs);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cAbs(cSub(values[i], values[j])) < tol) {
        throw new Error(
          'funm: matrix has repeated (or numerically indistinguishable) eigenvalues and is not ' +
            'diagonal — defective/non-diagonalizable matrices are not supported (Schur-Parlett ' +
            'block recurrence not yet implemented)'
        );
      }
    }
  }

  // Lagrange-Sylvester interpolation:
  //   f(A) = sum_i f(lambda_i) * prod_{j != i} (A - lambda_j I) / (lambda_i - lambda_j)
  //
  // n >= 2 here (n === 1 is always diagonal and handled above), so the inner
  // loop always runs at least once and `numerator` is always assigned.
  const F = cZeros(n);
  for (let i = 0; i < n; i++) {
    const lambdaI = values[i];
    let numerator: ComplexMatrix = cFromReal(A); // placeholder, overwritten on first j
    let denom: ComplexValue = { re: 1, im: 0 };
    let first = true;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const factor = cShiftedReal(A, values[j]);
      numerator = first ? factor : cMatMul(numerator, factor);
      first = false;
      denom = cMul(denom, cSub(lambdaI, values[j]));
    }
    cAccumulate(F, f(lambdaI), cMatScalarDiv(numerator, denom));
  }

  return F;
}

/** Complex cosine: `cos(z) = cos(re)cosh(im) - i sin(re)sinh(im)`. */
export function complexCos(z: ComplexValue): ComplexValue {
  return {
    re: Math.cos(z.re) * Math.cosh(z.im),
    im: -Math.sin(z.re) * Math.sinh(z.im),
  };
}

/** Complex sine: `sin(z) = sin(re)cosh(im) + i cos(re)sinh(im)`. */
export function complexSin(z: ComplexValue): ComplexValue {
  return {
    re: Math.sin(z.re) * Math.cosh(z.im),
    im: Math.cos(z.re) * Math.sinh(z.im),
  };
}

/** Matrix cosine `cos(A)`, via {@link funm} with {@link complexCos}. */
export function cosm(A: number[][]): ComplexMatrix {
  return funm(A, complexCos);
}

/** Matrix sine `sin(A)`, via {@link funm} with {@link complexSin}. */
export function sinm(A: number[][]): ComplexMatrix {
  return funm(A, complexSin);
}
