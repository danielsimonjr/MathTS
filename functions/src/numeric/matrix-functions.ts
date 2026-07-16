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
 * Defective / repeated-eigenvalue matrices (confluent Hermite interpolation):
 *   - When eigenvalues repeat (or cluster within `EIGENVALUE_DISTINCT_REL_TOL`),
 *     `f(A)` depends on `f` AND its derivatives at each repeated eigenvalue —
 *     for a Jordan block `J = λI + N` (N nilpotent, `N^s = 0`),
 *       f(J) = Σ_{k=0}^{s-1} f^(k)(λ)/k! · N^k.
 *     `funm` builds the confluent node list (each distinct eigenvalue repeated
 *     to its multiplicity) and evaluates the Newton divided-difference form
 *       f(A) = Σ_k f[z_0,…,z_k] · Π_{i<k}(A − z_i I),
 *     where a run of equal nodes contributes the Taylor coefficient
 *     `f^(L)(z)/L!`. This subsumes the simple-spectrum Lagrange path.
 *   - Derivatives of `f` come from the optional `fDerivs` argument
 *     (`fDerivs[k] = f^(k+1)`, machine precision — wired for `cosm`/`sinm`) or,
 *     when omitted, from finite-difference stencils (~1e-6 accuracy).
 *   - `funm` throws (rather than return a wrong/`NaN` answer) only when `f` or a
 *     derivative is genuinely singular at a repeated eigenvalue (e.g.
 *     `sqrt`/`log` at 0) or when a needed numerical derivative order exceeds the
 *     built-in stencils (multiplicity > 5 with no analytic derivatives).
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

function cAdd(a: ComplexValue, b: ComplexValue): ComplexValue {
  return { re: a.re + b.re, im: a.im + b.im };
}

/** Multiply a complex number by a real scalar. */
function cScale(a: ComplexValue, s: number): ComplexValue {
  return { re: a.re * s, im: a.im * s };
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

/** `n x n` complex identity matrix. */
function cIdentity(n: number): ComplexMatrix {
  const m = cZeros(n);
  for (let i = 0; i < n; i++) m.re[i][i] = 1;
  return m;
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

/** A distinct eigenvalue and how many times it occurs in the spectrum. */
interface EigCluster {
  value: ComplexValue;
  count: number;
}

/**
 * Cluster a spectrum into distinct eigenvalues with multiplicities. Two
 * eigenvalues within `tol` of each other are the "same" (defective / repeated
 * case); the cluster representative is the running mean of its members (more
 * robust than picking one QR-perturbed value). Σ(count) = spectrum length.
 */
function clusterEigenvalues(values: ComplexValue[], tol: number): EigCluster[] {
  const acc: { sumRe: number; sumIm: number; count: number }[] = [];
  for (const v of values) {
    let placed = false;
    for (const c of acc) {
      const rep = { re: c.sumRe / c.count, im: c.sumIm / c.count };
      if (cAbs(cSub(v, rep)) < tol) {
        c.sumRe += v.re;
        c.sumIm += v.im;
        c.count += 1;
        placed = true;
        break;
      }
    }
    if (!placed) acc.push({ sumRe: v.re, sumIm: v.im, count: 1 });
  }
  return acc.map((c) => ({
    value: { re: c.sumRe / c.count, im: c.sumIm / c.count },
    count: c.count,
  }));
}

/** k! as a floating-point number (k small — bounded by matrix dimension). */
function factorialNum(k: number): number {
  let r = 1;
  for (let i = 2; i <= k; i++) r *= i;
  return r;
}

/**
 * `f^(order)(z)` by a central finite-difference stencil (perturbing the real
 * part; for analytic `f` the real-direction derivative equals the complex
 * derivative). Steps are order-tuned to balance truncation vs round-off; these
 * are O(h²)-accurate and honest to ~1e-6..1e-10, NOT machine precision — supply
 * analytic derivatives via `funm`'s third argument for full accuracy.
 */
function numericalDerivative(
  f: ScalarComplexFunction,
  z: ComplexValue,
  order: number
): ComplexValue {
  const at = (dx: number): ComplexValue => f({ re: z.re + dx, im: z.im });
  switch (order) {
    case 1: {
      const h = 1e-6;
      return cScale(cSub(at(h), at(-h)), 1 / (2 * h));
    }
    case 2: {
      const h = 1e-4;
      const t = cSub(cAdd(at(h), at(-h)), cScale(at(0), 2));
      return cScale(t, 1 / (h * h));
    }
    case 3: {
      const h = 1e-3;
      // (f(2h) - 2f(h) + 2f(-h) - f(-2h)) / (2 h^3)
      const t = cSub(cAdd(at(2 * h), cScale(at(-h), 2)), cAdd(cScale(at(h), 2), at(-2 * h)));
      return cScale(t, 1 / (2 * h * h * h));
    }
    case 4: {
      const h = 1e-2;
      // (f(2h) - 4f(h) + 6f(0) - 4f(-h) + f(-2h)) / h^4
      let t = at(2 * h);
      t = cSub(t, cScale(at(h), 4));
      t = cAdd(t, cScale(at(0), 6));
      t = cSub(t, cScale(at(-h), 4));
      t = cAdd(t, at(-2 * h));
      return cScale(t, 1 / (h * h * h * h));
    }
    default:
      throw new Error(
        `funm: numerical derivatives of order ${order} are not supported (eigenvalue ` +
          `multiplicity ${order + 1} exceeds the finite-difference stencils); supply analytic ` +
          `derivatives via the fDerivs argument (fDerivs[k] = f^(k+1))`
      );
  }
}

/**
 * Taylor coefficients `f^(L)(z)/L!` for `L = 0..maxOrder` at a repeated
 * eigenvalue `z`. `fDerivs[k]` (if supplied and long enough) is `f^(k+1)`
 * (machine precision); otherwise the derivative is computed numerically.
 */
function taylorCoeffs(
  f: ScalarComplexFunction,
  fDerivs: ScalarComplexFunction[] | undefined,
  z: ComplexValue,
  maxOrder: number
): ComplexValue[] {
  const coeffs: ComplexValue[] = [f(z)];
  for (let L = 1; L <= maxOrder; L++) {
    const deriv = fDerivs && fDerivs.length >= L ? fDerivs[L - 1](z) : numericalDerivative(f, z, L);
    coeffs.push(cScale(deriv, 1 / factorialNum(L)));
  }
  return coeffs;
}

/** True iff every entry of the complex matrix is finite. */
function cIsFinite(M: ComplexMatrix): boolean {
  for (let i = 0; i < M.re.length; i++) {
    for (let j = 0; j < M.re.length; j++) {
      if (!Number.isFinite(M.re[i][j]) || !Number.isFinite(M.im[i][j])) return false;
    }
  }
  return true;
}

/**
 * Evaluate the matrix function `f(A)` for a square real matrix `A`, returning
 * a complex matrix `{re, im}`.
 *
 * Supports:
 *   - diagonal matrices unconditionally (exact, elementwise);
 *   - diagonalizable matrices with pairwise-distinct eigenvalues
 *     (Lagrange-Sylvester interpolation — the fast simple-spectrum branch);
 *   - defective / non-diagonalizable matrices with repeated (or numerically
 *     clustered) eigenvalues, via **confluent Hermite interpolation** (Newton
 *     divided differences over repeated eigenvalue nodes). A matrix function of
 *     a defective matrix depends on `f` AND its derivatives at each repeated
 *     eigenvalue (for a Jordan block `J = λI + N`, `f(J) = Σ_k f^(k)(λ)/k! · N^k`),
 *     so this branch needs derivatives of `f`: pass them analytically via
 *     `fDerivs` for machine precision, or they are approximated numerically.
 *
 * Throws (rather than return a wrong/`NaN` answer) when `f` or its derivatives
 * are singular at a repeated eigenvalue (e.g. `sqrt`/`log` at 0), or when a
 * needed numerical derivative order exceeds the built-in stencils.
 *
 * @param A - Square real matrix, as a plain 2-D array.
 * @param f - Scalar function to apply to the spectrum, e.g. `cos`, `sin`,
 *   `sqrt`, `exp`, `log`, extended to complex arguments.
 * @param fDerivs - Optional analytic derivatives of `f`: `fDerivs[k]` is
 *   `f^(k+1)`. Needed only for defective matrices; when omitted, derivatives
 *   are computed by finite differences (~1e-6 accuracy). Additive and
 *   non-breaking — distinct-spectrum inputs never consult it.
 * @returns `{ re, im }` — the (possibly complex) matrix `f(A)`.
 */
export function funm(
  A: number[][],
  f: ScalarComplexFunction,
  fDerivs?: ScalarComplexFunction[]
): ComplexMatrix {
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
  const clusters = clusterEigenvalues(values, tol);

  if (clusters.length === n) {
    // Simple spectrum (all multiplicities 1): Lagrange-Sylvester interpolation.
    //   f(A) = sum_i f(lambda_i) * prod_{j != i} (A - lambda_j I) / (lambda_i - lambda_j)
    //
    // Use the raw eigenvalues (not cluster means, identical here) so the
    // distinct-spectrum result is bit-for-bit the historical one.
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

  // Defective / repeated spectrum: confluent Hermite interpolation.
  //
  // Build the confluent node list z_0..z_{n-1} (each distinct eigenvalue
  // repeated to its multiplicity, grouped consecutively) and the per-cluster
  // Taylor coefficients f^(L)(z)/L!. The matrix function is the Newton form
  //   f(A) = Σ_k c_k · Π_{i<k}(A − z_i I),   c_k = f[z_0,…,z_k]
  // where c_k are confluent divided differences (a run of equal nodes yields
  // the Taylor coefficient). This subsumes the simple-spectrum case.
  const nodes: ComplexValue[] = [];
  const clusterIdx: number[] = [];
  const taylor: ComplexValue[][] = clusters.map((c) =>
    taylorCoeffs(f, fDerivs, c.value, c.count - 1)
  );
  clusters.forEach((c, ci) => {
    for (let r = 0; r < c.count; r++) {
      nodes.push(c.value);
      clusterIdx.push(ci);
    }
  });

  // Confluent divided-difference table: dd[i][j] = f[z_i, …, z_j] (i <= j).
  const dd: ComplexValue[][] = Array.from({ length: n }, () => new Array<ComplexValue>(n));
  for (let i = 0; i < n; i++) dd[i][i] = taylor[clusterIdx[i]][0]; // f(z_i)
  for (let L = 1; L < n; L++) {
    for (let i = 0; i + L < n; i++) {
      const j = i + L;
      if (clusterIdx[i] === clusterIdx[j]) {
        // Fully confluent span (nodes grouped): f^(L)(z)/L!.
        dd[i][j] = taylor[clusterIdx[i]][L];
      } else {
        dd[i][j] = cDiv(cSub(dd[i + 1][j], dd[i][j - 1]), cSub(nodes[j], nodes[i]));
      }
    }
  }

  // Horner-free Newton accumulation: P_k = Π_{i<k}(A − z_i I).
  const F = cZeros(n);
  let P = cIdentity(n);
  cAccumulate(F, dd[0][0], P);
  for (let k = 1; k < n; k++) {
    P = cMatMul(P, cShiftedReal(A, nodes[k - 1]));
    cAccumulate(F, dd[0][k], P);
  }

  if (!cIsFinite(F)) {
    throw new Error(
      'funm: result is non-finite — f (or one of its derivatives) is singular at a repeated ' +
        'eigenvalue (e.g. sqrt/log at 0), so the matrix function is undefined there'
    );
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

/**
 * Analytic derivative array for `cos`/`sin`: `cos^(m)(z) = cos(z + mπ/2)` and
 * `sin^(m)(z) = sin(z + mπ/2)`. Returns `fDerivs` with `fDerivs[k] = f^(k+1)`,
 * sized to the largest derivative order a defective `n×n` matrix can need
 * (`n-1`), so `funm`'s defective branch is machine-precise for `cosm`/`sinm`.
 */
function trigDerivs(base: typeof complexCos, n: number): ScalarComplexFunction[] {
  return Array.from({ length: Math.max(0, n - 1) }, (_unused, k) => {
    const shift = ((k + 1) * Math.PI) / 2;
    return (z: ComplexValue) => base({ re: z.re + shift, im: z.im });
  });
}

/** Matrix cosine `cos(A)`, via {@link funm} with {@link complexCos}. Passes
 * exact analytic derivatives so defective matrices are machine-precise. */
export function cosm(A: number[][]): ComplexMatrix {
  return funm(A, complexCos, trigDerivs(complexCos, A.length));
}

/** Matrix sine `sin(A)`, via {@link funm} with {@link complexSin}. Passes
 * exact analytic derivatives so defective matrices are machine-precise. */
export function sinm(A: number[][]): ComplexMatrix {
  return funm(A, complexSin, trigDerivs(complexSin, A.length));
}
