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

/** True for a square `number[][]` of side ≥ NATIVE_MATRIX_THRESHOLD. */
export function isLargeNumericSquare(a: unknown): a is number[][] {
  if (!Array.isArray(a) || a.length < NATIVE_MATRIX_THRESHOLD) return false;
  const n = a.length;
  for (const row of a) {
    if (!Array.isArray(row) || row.length !== n) return false;
    for (let j = 0; j < n; j++) if (typeof row[j] !== 'number') return false;
  }
  return true;
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

const EIG_IM_TOL = 1e-10;

/** True for a square `number[][]` of any size ≥ 1. */
export function isNumericSquare(a: unknown): a is number[][] {
  if (!Array.isArray(a) || a.length === 0) return false;
  const n = a.length;
  for (const row of a) {
    if (!Array.isArray(row) || row.length !== n) return false;
    for (let j = 0; j < n; j++) if (typeof row[j] !== 'number') return false;
  }
  return true;
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
 * eigenvectors }` shape. Non-(numeric square) inputs and any native error fall
 * back to the factory.
 */
export function correctEigs(
  a: unknown,
  options: { eigenvectors?: boolean } | undefined,
  factoryEigs: (m: unknown, o?: unknown) => unknown
): unknown {
  const toFactory = (): unknown => (options === undefined ? factoryEigs(a) : factoryEigs(a, options));
  if (!isNumericSquare(a)) return toFactory();
  const wantVectors = options?.eigenvectors !== false;
  try {
    const ne = eig(a, { computeVectors: wantVectors }) as {
      values: Array<{ re: number; im: number }>;
      vectors: number[][];
    };
    const pairs = ne.values.map((v, i) => ({
      value: (Math.abs(v.im) < EIG_IM_TOL ? v.re : new Complex(v.re, v.im)) as number | Complex,
      vector: ne.vectors[i],
    }));
    const reOf = (x: number | Complex): number => (typeof x === 'number' ? x : x.re);
    const imOf = (x: number | Complex): number => (typeof x === 'number' ? 0 : x.im);
    pairs.sort((p, q) => reOf(p.value) - reOf(q.value) || imOf(p.value) - imOf(q.value));
    const values = pairs.map((p) => p.value);
    return wantVectors ? { values, eigenvectors: pairs } : { values };
  } catch {
    return toFactory();
  }
}
