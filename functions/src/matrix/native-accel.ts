/**
 * Native-accelerated fast paths for matrix factory functions.
 *
 * The activated mathjs matrix factories operate on boxed `number[][]`, which is
 * pathologically slow for large matrices (an 80×80 `det` took ~90 ms). The
 * native `@danielsimonjr/mathts-matrix` package is Float64Array-backed; routing
 * the heavy numeric case through it is dramatically faster while staying exact
 * for the cases that matter.
 *
 * Design contract: these helpers can never be *less* correct than the factory
 * implementation. The `det`/`inv` helpers engage only for large square all-numeric
 * matrices (performance); `correctEigs` engages for *any* numeric square matrix
 * (correctness — the factory `eigs` is simply wrong for non-symmetric input). For
 * anything else (non-numeric, non-square, or any native-side error) they fall back
 * to the supplied factory function. The one special case — native LU throwing on a
 * singular matrix — is handled correctly (a singular matrix has det 0), verified
 * against numpy.
 */
import { DenseMatrix, lu, eig } from '@danielsimonjr/mathts-matrix';
import { Complex } from '@danielsimonjr/mathts-core';

/** Below this dimension the factory path is already sub-millisecond; native
 *  conversion overhead isn't worth it and the well-tested factory path runs. */
export const NATIVE_MATRIX_THRESHOLD = 8;

/**
 * True when `a` is a square `number[][]` with side length at least `minSide`.
 * @internal Shared scan for native fast-path gating (`minSide` is the only setting).
 */
function isNumericSquareAtLeast(a: unknown, minSide: number): a is number[][] {
  if (!Array.isArray(a) || a.length < minSide) return false;
  const n = a.length;
  for (const row of a) {
    if (!Array.isArray(row) || row.length !== n) return false;
    for (let j = 0; j < n; j++) if (typeof row[j] !== 'number') return false;
  }
  return true;
}

/** True for a square `number[][]` of side ≥ NATIVE_MATRIX_THRESHOLD. */
export function isLargeNumericSquare(a: unknown): a is number[][] {
  return isNumericSquareAtLeast(a, NATIVE_MATRIX_THRESHOLD);
}

/** Sign of a permutation given as an image array P (P[i] = source row of output row i). */
function permutationParity(P: ReadonlyArray<number>): number {
  let sign = 1;
  const seen = new Array<boolean>(P.length).fill(false);
  for (let i = 0; i < P.length; i++) {
    if (seen[i]) continue;
    let j = i;
    let len = 0;
    while (!seen[j]) {
      seen[j] = true;
      j = P[j];
      len++;
    }
    if (len % 2 === 0) sign = -sign; // an L-cycle contributes (-1)^(L-1)
  }
  return sign;
}

const SINGULAR = /singular|zero pivot/i;

/**
 * Determinant via native Float64Array LU: det = parity(P) · ∏ diag(U).
 * Falls back to `factoryDet` for non-(large numeric square) inputs or any
 * non-singular native error; a singular matrix correctly yields 0.
 */
export function acceleratedDet<T>(a: unknown, factoryDet: (m: unknown) => T): T {
  if (!isLargeNumericSquare(a)) return factoryDet(a);
  try {
    const { U, P } = lu(DenseMatrix.fromArray(a)) as { U: { toArray(): number[][] }; P: number[] };
    const Ud = U.toArray();
    let d = permutationParity(P);
    for (let i = 0; i < a.length; i++) d *= Ud[i][i];
    return d as unknown as T;
  } catch (e) {
    if (e instanceof Error && SINGULAR.test(e.message)) return 0 as unknown as T;
    return factoryDet(a); // any other native failure → proven factory path
  }
}

/**
 * Inverse via native Float64Array LU + forward/back substitution: solve A·xⱼ = eⱼ
 * for each column. Falls back to `factoryInv` for non-(large numeric square)
 * inputs; on a singular matrix the native LU throws and we delegate to the
 * factory, which raises the proper "Cannot calculate inverse, determinant is
 * zero" error — so behaviour is identical to the factory, just faster.
 * Verified against numpy: max|inv−numpy| and max|A·inv−I| ~1e-15.
 */
export function acceleratedInv<T>(a: unknown, factoryInv: (m: unknown) => T): T {
  if (!isLargeNumericSquare(a)) return factoryInv(a);
  try {
    const { L, U, P } = lu(DenseMatrix.fromArray(a)) as {
      L: { toArray(): number[][] };
      U: { toArray(): number[][] };
      P: number[];
    };
    const Ld = L.toArray();
    const Ud = U.toArray();
    const n = a.length;
    const inv: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let j = 0; j < n; j++) {
      // b = P·eⱼ
      const b = new Array<number>(n).fill(0);
      for (let i = 0; i < n; i++) if (P[i] === j) b[i] = 1;
      // forward solve L·y = b (L unit-lower-triangular)
      const y = new Array<number>(n).fill(0);
      for (let i = 0; i < n; i++) {
        let s = b[i];
        for (let k = 0; k < i; k++) s -= Ld[i][k] * y[k];
        y[i] = s / Ld[i][i];
      }
      // back solve U·x = y
      const x = new Array<number>(n).fill(0);
      for (let i = n - 1; i >= 0; i--) {
        let s = y[i];
        for (let k = i + 1; k < n; k++) s -= Ud[i][k] * x[k];
        x[i] = s / Ud[i][i];
      }
      for (let i = 0; i < n; i++) inv[i][j] = x[i];
    }
    return inv as unknown as T;
  } catch {
    return factoryInv(a); // singular / any native failure → proven factory path
  }
}

/** Largest absolute entry of a numeric matrix: the scale of its spectrum. */
function maxAbsEntry(a: number[][]): number {
  let m = 0;
  for (const row of a) for (const x of row) if (Math.abs(x) > m) m = Math.abs(x);
  return m;
}

/**
 * The test that an eigenvalue of `a` is real: its imaginary part is rounding noise, `|im| <=
 * 8 n eps scale`. The scale is local (#1240). A scale of the whole matrix, its largest entry,
 * reads `1e-5 +- i` beside an entry of 1e20 as real, because the noise of the huge entry is far
 * above 1. Every eigenvalue lies in the Gershgorin disc of some row, `|l - a_ii| <= R_i` with R_i
 * the sum of the other entries of the row. The scale of an eigenvalue is the largest entry of the
 * rows whose disc holds it. The discs have a slack of the noise of the largest entry, `8 n eps
 * max|a|`, so a value that rounding moved from its disc still finds its rows. When no row holds
 * the value, the scale is the largest entry of the matrix. The test uses the eigenvalue alone, so
 * `values` does not depend on `eigenvectors`.
 */
function makeIsReal(a: number[][]): (v: { re: number; im: number }) => boolean {
  const n = a.length;
  const noise = 8 * n * Number.EPSILON;
  const global = maxAbsEntry(a);
  const slack = noise * global;
  const rows = a.map((row, i) => {
    let radius = 0;
    let top = 0;
    for (let j = 0; j < n; j++) {
      const x = Math.abs(row[j]);
      if (j !== i) radius += x;
      if (x > top) top = x;
    }
    return { centre: row[i], radius: radius + slack, top };
  });
  return (v) => {
    let scale = 0;
    for (const { centre, radius, top } of rows) {
      if (top > scale && Math.hypot(v.re - centre, v.im) <= radius) scale = top;
    }
    return Math.abs(v.im) <= noise * (scale > 0 ? scale : global);
  };
}

/**
 * The real part of eigenvector `i`, or, for a pair that rounds to a repeated real eigenvalue, a
 * real eigenvector of that eigenvalue. The two members of a pair share the real part
 * `vectors[i]`, so the member with im < 0 takes the imaginary part `vectorsIm[i]` instead, scaled
 * to unit norm. The pair then keeps two independent eigenvectors.
 */
function realVector(
  ne: { values: Array<{ re: number; im: number }>; vectors: number[][]; vectorsIm: number[][] },
  i: number,
  isReal: (v: { re: number; im: number }) => boolean
): number[] {
  const im = ne.values[i].im;
  if (im >= 0 || !isReal(ne.values[i])) return ne.vectors[i];
  const v = ne.vectorsIm[i];
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

/** True for a square `number[][]` of any size ≥ 1. */
export function isNumericSquare(a: unknown): a is number[][] {
  return isNumericSquareAtLeast(a, 1);
}

/**
 * Select `count` members of `group` whose eigenvectors are the most independent.
 *
 * The function uses a greedy pivoted Gram-Schmidt over complex vectors. Each step takes
 * the member with the largest remaining residual and removes its direction from the
 * other residuals. Row `i` of `re` and `im` is the eigenvector of eigenvalue `i`.
 * The copies of a defective eigenvalue are almost parallel, so the first selection
 * has a small effect on the result.
 */
function independentMembers(
  re: number[][],
  im: number[][],
  group: number[],
  count: number
): Set<number> {
  const chosen = new Set<number>();
  const residual = group.map((i) => ({ re: re[i].slice(), im: im[i].slice() }));
  while (chosen.size < count && chosen.size < group.length) {
    let best = -1;
    let bestNorm = -1;
    residual.forEach((r, k) => {
      if (chosen.has(group[k])) return;
      let sum = 0;
      for (let j = 0; j < r.re.length; j++) sum += r.re[j] * r.re[j] + r.im[j] * r.im[j];
      if (sum > bestNorm) {
        bestNorm = sum;
        best = k;
      }
    });
    chosen.add(group[best]);
    const norm = Math.sqrt(bestNorm) || 1;
    const q = {
      re: residual[best].re.map((x) => x / norm),
      im: residual[best].im.map((x) => x / norm),
    };
    for (const r of residual) {
      // r -= (q^H r) q
      let pr = 0;
      let pi = 0;
      for (let j = 0; j < q.re.length; j++) {
        pr += q.re[j] * r.re[j] + q.im[j] * r.im[j];
        pi += q.re[j] * r.im[j] - q.im[j] * r.re[j];
      }
      for (let j = 0; j < q.re.length; j++) {
        r.re[j] -= pr * q.re[j] - pi * q.im[j];
        r.im[j] -= pr * q.im[j] + pi * q.re[j];
      }
    }
  }
  return chosen;
}

/**
 * Correct eigendecomposition for the public `eigs`.
 *
 * The activated mathjs factory `eigs` returns WRONG eigenvalues for *every*
 * non-symmetric matrix — even trivial upper-triangular ones, whose eigenvalues
 * are just the diagonal (e.g. [[2,1,0],[0,3,1],[0,0,4]] → [1.27, 3, 4.73]). The
 * native `@danielsimonjr/mathts-matrix` `eig` (JAMA orthes/hqr2) is correct for
 * symmetric, non-symmetric, and complex spectra (verified vs numpy), so route all
 * numeric square matrices through it and emit the factory's `{ values,
 * eigenvectors }` shape. Non-(numeric square) inputs and any native error
 * other than a RangeError fall back to the factory; a RangeError from the native
 * solver propagates (a non-finite entry, a non-finite eigenvalue, no convergence).
 */
export function correctEigs(
  a: unknown,
  options: { eigenvectors?: boolean } | undefined,
  factoryEigs: (m: unknown, o?: unknown) => unknown
): unknown {
  const toFactory = (): unknown =>
    options === undefined ? factoryEigs(a) : factoryEigs(a, options);
  if (!isNumericSquare(a)) return toFactory();
  const wantVectors = options?.eigenvectors !== false;
  try {
    const ne = eig(a, { computeVectors: wantVectors });
    // A defective eigenvalue has fewer independent eigenvectors than copies. The list holds
    // one pair per independent direction, as the documented contract of `eigs` says.
    const keep = new Set<number>(ne.values.map((_, i) => i));
    if (wantVectors) {
      for (const group of ne.repeatedEigenvalues) {
        if (group.defective) {
          const chosen = independentMembers(
            ne.vectors,
            ne.vectorsIm,
            group.indices,
            group.independentEigenvectors
          );
          for (const i of group.indices) if (!chosen.has(i)) keep.delete(i);
        }
      }
    }
    // As in mathjs, one complex eigenvalue makes every eigenvector a Complex[];
    // a real spectrum keeps number[] vectors.
    // A real eigenvalue of a real matrix has an im of exactly 0, except when it is repeated: the
    // copies of a repeated real eigenvalue can come out as a conjugate pair with an im of rounding
    // size (mostly below 2 * n * eps * the local scale; an ill-conditioned repeated eigenvalue can
    // exceed the bound of `makeIsReal` and then stays a pair, as in NumPy). A genuine pair, however
    // near to real, has a larger im (the 2x2 block of a split Jordan block: about sqrt(eps)).
    const isReal = makeIsReal(a);
    const anyComplex = ne.values.some((v) => !isReal(v));
    const vectorOf = (v: { re: number; im: number }, i: number): number[] | Complex[] => {
      const re = realVector(ne, i, isReal);
      if (!anyComplex) return re;
      return re.map((x, j) => new Complex(x, isReal(v) ? 0 : ne.vectorsIm[i][j]));
    };
    const all = ne.values.map((v, i) => ({
      value: (isReal(v) ? v.re : new Complex(v.re, v.im)) as number | Complex,
      vector: wantVectors ? vectorOf(v, i) : [],
      i,
    }));
    const reOf = (x: number | Complex): number => (typeof x === 'number' ? x : x.re);
    const imOf = (x: number | Complex): number => (typeof x === 'number' ? 0 : x.im);
    all.sort((p, q) => reOf(p.value) - reOf(q.value) || imOf(p.value) - imOf(q.value));
    const values = all.map((p) => p.value);
    const pairs = all.filter((p) => keep.has(p.i));
    return wantVectors
      ? { values, eigenvectors: pairs.map(({ value, vector }) => ({ value, vector })) }
      : { values };
  } catch (e) {
    if (e instanceof RangeError) throw e;
    return toFactory();
  }
}
