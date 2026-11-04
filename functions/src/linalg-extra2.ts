/**
 * Subspace angles, matrix sign, fractional matrix power and Cholesky rank-1
 * up/downdates (Gap-analysis 2026-11-04 Batch E8).
 */
import { matrixExpm, matrixLogm, singularValues } from './typed/matrix-ops.js';

type Vec = readonly number[] | Float64Array;

const _expm = matrixExpm as unknown as (A: number[][]) => number[][];
const _logm = matrixLogm as unknown as (A: number[][]) => number[][];
const _sv = singularValues as unknown as (A: number[][]) => number[];

const mul = (A: number[][], B: number[][]): number[][] =>
  A.map((row) =>
    Array.from({ length: B[0]?.length ?? 0 }, (_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0))
  );

const transpose = (A: number[][]): number[][] => (A[0] ?? []).map((_, j) => A.map((r) => r[j]));

/** Gauss-Jordan inverse with partial pivoting; also returns the determinant. */
function invDet(A: number[][]): { inv: number[][]; det: number } {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  let det = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (M[p][c] === 0) return { inv: [], det: 0 };
    if (p !== c) {
      [M[p], M[c]] = [M[c], M[p]];
      det = -det;
    }
    const pivot = M[c][c];
    det *= pivot;
    for (let k = 0; k < 2 * n; k++) M[c][k] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f !== 0) for (let k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return { inv: M.map((r) => r.slice(n)), det };
}

/**
 * Principal angles between the column spaces of A and B, in radians, sorted in
 * descending order (largest angle first, as documented for scipy.linalg.subspace_angles).
 * Each space is orthonormalised by modified Gram-Schmidt. As scipy does, angles whose
 * sine squared is below 1/2 are taken from the singular values of the residual
 * Qb - Qa Qaᵀ Qb (arcsin), the rest from those of Qaᵀ Qb (arccos), so small angles
 * keep full relative accuracy.
 */
export function subspaceAngles(A: number[][], B: number[][]): number[] {
  const orthonormal = (M: number[][]): number[][] => {
    const cols = transpose(M);
    const basis: number[][] = [];
    for (const c of cols) {
      const v = c.slice();
      for (const q of basis) {
        const d = q.reduce((s, x, k) => s + x * v[k], 0);
        for (let k = 0; k < v.length; k++) v[k] -= d * q[k];
      }
      const nrm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      if (nrm > 1e-12) basis.push(v.map((x) => x / nrm));
    }
    return transpose(basis);
  };
  let Qa = orthonormal(A);
  let Qb = orthonormal(B);
  if (Qa.length === 0 || Qb.length === 0) return [];
  // Keep the smaller space second so the residual has min(rank) columns.
  if ((Qa[0]?.length ?? 0) < (Qb[0]?.length ?? 0)) [Qa, Qb] = [Qb, Qa];
  const M = mul(transpose(Qa), Qb);
  const cosines = _sv(M).sort((x, y) => y - x); // descending: angles ascending
  const proj = mul(Qa, M);
  const resid = Qb.map((row, i) => row.map((x, j) => x - proj[i][j]));
  const sines = _sv(resid).sort((x, y) => x - y); // ascending: angles ascending
  const k = Math.min(cosines.length, sines.length);
  const angles: number[] = [];
  for (let i = 0; i < k; i++) {
    const sn = Math.min(1, sines[i]);
    angles.push(sn * sn < 0.5 ? Math.asin(sn) : Math.acos(Math.min(1, Math.max(-1, cosines[i]))));
  }
  return angles.sort((x, y) => y - x);
}

/**
 * Matrix sign function sign(A) by the determinant-scaled Newton iteration
 * X <- (mu X + (mu X)^-1) / 2 with mu = |det X|^(-1/n). Returns the n x n sign matrix.
 */
export function signm(A: number[][], opts: { tol?: number; maxIter?: number } = {}): number[][] {
  const tol = opts.tol ?? 1e-12;
  const maxIter = opts.maxIter ?? 100;
  const n = A.length;
  let X = A.map((r) => r.slice());
  for (let it = 0; it < maxIter; it++) {
    const { inv, det } = invDet(X);
    if (det === 0) throw new RangeError('signm: matrix is singular at an iterate');
    const mu = Math.pow(Math.abs(det), -1 / n);
    const next = X.map((row, i) => row.map((x, j) => 0.5 * (mu * x + inv[i][j] / mu)));
    let diff = 0;
    let norm = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        diff += Math.abs(next[i][j] - X[i][j]);
        norm += Math.abs(next[i][j]);
      }
    X = next;
    if (diff <= tol * norm) break;
  }
  return X;
}

/** Integer matrix power by repeated squaring (negative powers via the inverse). */
function integerPower(A: number[][], t: number): number[][] {
  const n = A.length;
  let base = A;
  if (t < 0) {
    const r = invDet(A);
    if (r.det === 0) throw new RangeError('fractionalMatrixPower: matrix is singular');
    base = r.inv;
  }
  let e = Math.abs(t);
  let result: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  while (e > 0) {
    if (e % 2 === 1) result = mul(result, base);
    base = mul(base, base);
    e = Math.floor(e / 2);
  }
  return result;
}

/**
 * Fractional matrix power A^t = expm(t * logm(A)) for a matrix with a principal
 * logarithm. Integer t is computed exactly by repeated multiplication.
 */
export function fractionalMatrixPower(A: number[][], t: number): number[][] {
  if (Number.isInteger(t)) return integerPower(A, t);
  const L = _logm(A);
  return _expm(L.map((row) => row.map((x) => x * t)));
}

/**
 * Cholesky factor of L Lᵀ + x xᵀ, given the lower-triangular factor L.
 * Standard rank-1 update (Golub & Van Loan, Alg. 6.5.4).
 */
export function choleskyUpdate(L: number[][], x: Vec): number[][] {
  const n = L.length;
  const out = L.map((r) => r.slice());
  const w = Array.from(x);
  for (let k = 0; k < n; k++) {
    const r = Math.hypot(out[k][k], w[k]);
    const c = r / out[k][k];
    const s = w[k] / out[k][k];
    out[k][k] = r;
    for (let i = k + 1; i < n; i++) {
      out[i][k] = (out[i][k] + s * w[i]) / c;
      w[i] = c * w[i] - s * out[i][k];
    }
  }
  return out;
}

/**
 * Cholesky factor of L Lᵀ - x xᵀ, given the lower-triangular factor L.
 *
 * @throws RangeError if the downdated matrix is not positive definite
 */
export function choleskyDowndate(L: number[][], x: Vec): number[][] {
  const n = L.length;
  const out = L.map((r) => r.slice());
  const w = Array.from(x);
  for (let k = 0; k < n; k++) {
    const r2 = out[k][k] * out[k][k] - w[k] * w[k];
    if (!(r2 > 0)) {
      throw new RangeError('choleskyDowndate: downdated matrix is not positive definite');
    }
    const r = Math.sqrt(r2);
    const c = r / out[k][k];
    const s = w[k] / out[k][k];
    out[k][k] = r;
    for (let i = k + 1; i < n; i++) {
      out[i][k] = (out[i][k] - s * w[i]) / c;
      w[i] = c * w[i] - s * out[i][k];
    }
  }
  return out;
}
