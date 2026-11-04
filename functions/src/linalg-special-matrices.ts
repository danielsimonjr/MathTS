/**
 * Special matrix constructors (Gap-analysis 2026-11-04 Batch E7).
 *
 * Pure index/closed-form constructions: Hilbert and its exact integer inverse,
 * Hadamard (Sylvester), Pascal, DFT, Hankel, block-diagonal, Khatri-Rao,
 * Fiedler, Leslie and Helmert matrices.
 */
import { Complex } from '@danielsimonjr/mathts-core';

type Vec = readonly number[] | Float64Array;

const arr = (v: Vec): number[] => Array.from(v);

/** Binomial coefficient C(n, k) for non-negative integers (exact while representable). */
function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= kk; i++) r = (r * (n - kk + i)) / i;
  return Math.round(r);
}

/** Hilbert matrix H_ij = 1 / (i + j + 1) (0-based). */
export function hilbertMatrix(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => 1 / (i + j + 1)));
}

/**
 * Exact inverse of the n x n Hilbert matrix, from the closed-form integer formula
 * (1-based indices): (-1)^(i+j) (i+j-1) C(n+i-1, n-j) C(n+j-1, n-i) C(i+j-2, i-1)^2.
 */
export function invHilbertMatrix(n: number): number[][] {
  return Array.from({ length: n }, (_, a) =>
    Array.from({ length: n }, (_, b) => {
      const i = a + 1;
      const j = b + 1;
      const sign = (i + j) % 2 === 0 ? 1 : -1;
      const c = binom(i + j - 2, i - 1);
      return sign * (i + j - 1) * binom(n + i - 1, n - j) * binom(n + j - 1, n - i) * c * c;
    })
  );
}

/**
 * Hadamard matrix of order n by the Sylvester construction. n must be a power of 2.
 *
 * @throws RangeError if n is not a positive power of 2
 */
export function hadamardMatrix(n: number): number[][] {
  if (!Number.isInteger(n) || n < 1 || (n & (n - 1)) !== 0) {
    throw new RangeError(`hadamardMatrix: n must be a power of 2, got ${n}`);
  }
  let H: number[][] = [[1]];
  while (H.length < n) {
    const m = H.length;
    const next: number[][] = [];
    for (let i = 0; i < 2 * m; i++) {
      const row: number[] = [];
      for (let j = 0; j < 2 * m; j++) {
        const base = H[i % m][j % m];
        row.push(i >= m && j >= m ? -base : base);
      }
      next.push(row);
    }
    H = next;
  }
  return H;
}

/**
 * Pascal matrix. 'symmetric' P_ij = C(i+j, i); 'lower' L_ij = C(i, j); 'upper' is its transpose.
 */
export function pascalMatrix(
  n: number,
  kind: 'symmetric' | 'lower' | 'upper' = 'symmetric'
): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (kind === 'symmetric') return binom(i + j, i);
      if (kind === 'lower') return binom(i, j);
      return binom(j, i);
    })
  );
}

/**
 * Discrete Fourier transform matrix F_jk = exp(-2*pi*i*j*k/n) times a normalization:
 * 'none' = 1, 'sqrtn' = 1/sqrt(n), 'n' = 1/n.
 */
export function dftMatrix(n: number, opts: { scale?: 'none' | 'sqrtn' | 'n' } = {}): Complex[][] {
  const scale = opts.scale ?? 'none';
  const factor = scale === 'sqrtn' ? 1 / Math.sqrt(n) : scale === 'n' ? 1 / n : 1;
  return Array.from({ length: n }, (_, j) =>
    Array.from({ length: n }, (_, k) => {
      const angle = (-2 * Math.PI * ((j * k) % n)) / n;
      return new Complex(factor * Math.cos(angle), factor * Math.sin(angle));
    })
  );
}

/**
 * Hankel matrix with first column c and (optionally) last row r. r[0] is ignored
 * (the corner is c[last]); the default r is all zeros.
 */
export function hankelMatrix(c: Vec, r?: Vec): number[][] {
  const cv = arr(c);
  const rv = r === undefined ? new Array<number>(cv.length).fill(0) : arr(r);
  const m = cv.length;
  const cols = rv.length;
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: cols }, (_, j) => {
      const k = i + j;
      return k < m ? cv[k] : rv[k - m + 1];
    })
  );
}

/** Block-diagonal matrix from a list of (possibly rectangular) blocks. */
export function blockDiag(...blocks: ReadonlyArray<ReadonlyArray<readonly number[]>>): number[][] {
  const rows = blocks.reduce((s, b) => s + b.length, 0);
  const cols = blocks.reduce((s, b) => s + (b[0]?.length ?? 0), 0);
  const out: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  let r0 = 0;
  let c0 = 0;
  for (const b of blocks) {
    for (let i = 0; i < b.length; i++) {
      for (let j = 0; j < b[i].length; j++) out[r0 + i][c0 + j] = b[i][j];
    }
    r0 += b.length;
    c0 += b[0]?.length ?? 0;
  }
  return out;
}

/**
 * Khatri-Rao (column-wise Kronecker) product of A (p x k) and B (q x k):
 * a (p*q x k) matrix whose row i*q + j is A[i] elementwise-times B[j].
 *
 * @throws RangeError if the column counts differ
 */
export function khatriRao(A: number[][], B: number[][]): number[][] {
  const k = A[0]?.length ?? 0;
  if ((B[0]?.length ?? 0) !== k) {
    throw new RangeError('khatriRao: A and B must have the same number of columns');
  }
  const out: number[][] = [];
  for (const a of A) {
    for (const b of B) {
      out.push(Array.from({ length: k }, (_, c) => a[c] * b[c]));
    }
  }
  return out;
}

/** Fiedler matrix F_ij = |a_i - a_j|. */
export function fiedlerMatrix(a: Vec): number[][] {
  const v = arr(a);
  return v.map((x) => v.map((y) => Math.abs(x - y)));
}

/**
 * Leslie matrix: first row = fecundities f, subdiagonal = survival rates s.
 *
 * @throws RangeError unless s.length === f.length - 1
 */
export function leslieMatrix(f: Vec, s: Vec): number[][] {
  const fv = arr(f);
  const sv = arr(s);
  const n = fv.length;
  if (sv.length !== n - 1) {
    throw new RangeError('leslieMatrix: s must have length f.length - 1');
  }
  const L = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  L[0] = fv.slice();
  for (let i = 0; i < n - 1; i++) L[i + 1][i] = sv[i];
  return L;
}

/**
 * Helmert matrix. Returns the (n-1) x n orthonormal contrast rows, or the full
 * n x n orthogonal matrix when `full` is true (first row 1/sqrt(n)).
 */
export function helmertMatrix(n: number, full = false): number[][] {
  const rows: number[][] = [];
  if (full) rows.push(new Array<number>(n).fill(1 / Math.sqrt(n)));
  for (let k = 1; k <= n - 1; k++) {
    const row = new Array<number>(n).fill(0);
    const norm = Math.sqrt(k * (k + 1));
    for (let j = 0; j < k; j++) row[j] = 1 / norm;
    row[k] = -k / norm;
    rows.push(row);
  }
  return rows;
}
