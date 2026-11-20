/**
 * Dogfood #1179 - eigs of a Matrix runs the native solver, as eigs of an Array does.
 *
 * The public wrapper sent only `number[][]` to the native orthes/hqr2 solver. A Matrix went to the
 * factory QR iteration, which uses a real shift: it threw "failed to converge" for a matrix with
 * a complex pair (the #1238 matrix) and gave residuals of 5e-7 for others. A Matrix of numbers
 * now takes the native path and returns Matrix values and vectors.
 *
 * The value order of a Matrix does not change: the Matrix result keeps the factory order
 * (absolute value ascending, then real part descending, then imaginary part descending). The
 * Array result keeps the native order.
 */
import { describe, it, expect } from 'vitest';
import { isMatrix } from '@danielsimonjr/mathts-core';
import { eigs, matrix, fraction } from '../src/index.js';

type Ri = { re: number; im: number };

const toRi = (x: unknown): Ri => {
  if (typeof x === 'number') return { re: x, im: 0 };
  const o = x as { re?: unknown; im?: unknown };
  if (typeof o.re === 'number' && typeof o.im === 'number') return { re: o.re, im: o.im };
  return { re: Number(x), im: 0 };
};
const byValue = (p: Ri, q: Ri): number => p.re - q.re || p.im - q.im;
const show = (x: unknown): string => {
  const z = toRi(x);
  return z.im === 0 ? String(z.re) : `${z.re}${z.im < 0 ? '-' : '+'}${Math.abs(z.im)}i`;
};

type MatrixLike = { toArray(): unknown[] };
type PairResult = {
  values: unknown;
  eigenvectors?: Array<{ value: unknown; vector: unknown }>;
};
const run = (m: unknown, o?: object): PairResult => eigs(m as never, o as never) as PairResult;

/** |A v - l v| / (max|A| |v|) */
function residual(A: number[][], l: unknown, v: unknown[]): number {
  const lam = toRi(l);
  const vec = v.map(toRi);
  let amax = 0;
  for (const row of A) for (const x of row) amax = Math.max(amax, Math.abs(x));
  const vnorm = Math.hypot(...vec.map((z) => Math.hypot(z.re, z.im)));
  let worst = 0;
  for (let i = 0; i < A.length; i++) {
    let ar = 0;
    let ai = 0;
    for (let j = 0; j < A.length; j++) {
      ar += A[i][j] * vec[j].re;
      ai += A[i][j] * vec[j].im;
    }
    const er = ar - (lam.re * vec[i].re - lam.im * vec[i].im);
    const ei = ai - (lam.re * vec[i].im + lam.im * vec[i].re);
    worst = Math.max(worst, Math.hypot(er, ei));
  }
  return worst / (amax * vnorm);
}

/** The worst residual of every eigenvector pair of a Matrix result. */
function worstResidual(A: number[][], r: PairResult): number {
  let worst = 0;
  for (const { value, vector } of r.eigenvectors!) {
    worst = Math.max(worst, residual(A, value, (vector as MatrixLike).toArray()));
  }
  return worst;
}

const valuesOf = (r: PairResult): unknown[] => (r.values as MatrixLike).toArray();

const A1238 = [
  [1.552, -1.952, 1.325, 4.959],
  [1.795, 1.731, -3.273, 3.832],
  [2.073, 3.275, 2.394, -1.623],
  [2.939, -3.078, 0.799, -2.662],
];
const TRIAGE3 = [
  [-2.28, -4.27, -4.75],
  [-2.03, 3.95, -0.25],
  [-3, -0.76, 1.39],
];

describe('eigs of a Matrix (#1179)', () => {
  it('eigs(matrix([[0,-1],[1,0]])): values [i, -i] and a residual below 1e-14', () => {
    const A = [
      [0, -1],
      [1, 0],
    ];
    const r = run(matrix(A));
    expect(isMatrix(r.values)).toBe(true);
    expect(valuesOf(r).map(show)).toEqual(['0+1i', '0-1i']);
    expect(r.eigenvectors).toHaveLength(2);
    expect(worstResidual(A, r)).toBeLessThan(1e-14);
  });

  it('the triage 3x3 sample has a residual below 1e-13 (it was 5.3e-7)', () => {
    const r = run(matrix(TRIAGE3));
    expect(worstResidual(TRIAGE3, r)).toBeLessThan(1e-13);
    // the same value set as the Array input
    const fromArray = ((run(TRIAGE3).values as unknown[]).map(toRi) as Ri[]).sort(byValue);
    const fromMatrix = valuesOf(r).map(toRi).sort(byValue);
    expect(fromMatrix).toEqual(fromArray);
  });

  it('the value order of a Matrix is the factory order, as before', () => {
    const r = (re: number, im = 0): Ri => ({ re, im });
    const cases: Array<[string, number[][], Ri[]]> = [
      [
        'rotation',
        [
          [0, -1],
          [1, 0],
        ],
        [r(0, 1), r(0, -1)],
      ],
      [
        'diagonal 2x2',
        [
          [-3, 0],
          [0, 1],
        ],
        [r(1), r(-3)],
      ],
      [
        'real pair',
        [
          [1, 2],
          [3, -4],
        ],
        [r(2), r(-5)],
      ],
      [
        'complex pair',
        [
          [2, -5],
          [1, 0],
        ],
        [r(1, 2), r(1, -2)],
      ],
      ['triage 3x3', TRIAGE3, [r(3.0495637822793755), r(-5.455977102835088), r(5.466413320555723)]],
      [
        'diagonal 3x3',
        [
          [1, 0, 0],
          [0, -1, 0],
          [0, 0, 0.5],
        ],
        [r(0.5), r(1), r(-1)],
      ],
    ];
    for (const [name, A, want] of cases) {
      const got = valuesOf(run(matrix(A))).map(toRi);
      expect(got, name).toHaveLength(want.length);
      want.forEach((w, i) => {
        expect(Math.hypot(got[i].re - w.re, got[i].im - w.im), `${name} value ${i}`).toBeLessThan(
          1e-12
        );
      });
    }
  });

  it('the Array input keeps the native order', () => {
    expect(
      (
        run([
          [0, -1],
          [1, 0],
        ]).values as unknown[]
      ).map(show)
    ).toEqual(['0-1i', '0+1i']);
    expect(
      (
        run([
          [-3, 0],
          [0, 1],
        ]).values as unknown[]
      ).map(show)
    ).toEqual(['-3', '1']);
  });

  it('the #1238 matrix: no throw, a Matrix result, and the eigenvector residuals', () => {
    const r = run(matrix(A1238));
    expect(isMatrix(r.values)).toBe(true);
    for (const { vector } of r.eigenvectors!) expect(isMatrix(vector)).toBe(true);
    expect(r.eigenvectors).toHaveLength(4);
    expect(worstResidual(A1238, r)).toBeLessThan(1e-13);
    // the value of each pair is one of the values
    const set = valuesOf(r).map(toRi);
    for (const { value } of r.eigenvectors!) {
      const z = toRi(value);
      expect(set.some((w) => Math.hypot(w.re - z.re, w.im - z.im) === 0)).toBe(true);
    }
  });

  it('eigenvectors: false returns the values only; vectors stays a throwing getter', () => {
    const only = run(matrix(A1238), { eigenvectors: false });
    expect(isMatrix(only.values)).toBe(true);
    expect(only.eigenvectors).toBeUndefined();
    const withVectors = run(matrix(A1238));
    expect(() => (withVectors as unknown as { vectors: unknown }).vectors).toThrow(/eigenvectors/);
    expect(Object.keys(withVectors)).not.toContain('vectors');
  });

  it('the option matricize: false returns arrays, as the factory does', () => {
    const r = run(matrix(A1238), { matricize: false });
    expect(Array.isArray(r.values)).toBe(true);
    expect(r.eigenvectors).toHaveLength(4);
    for (const { vector } of r.eigenvectors!) expect(Array.isArray(vector)).toBe(true);
  });

  it('a number precision as the second argument is accepted', () => {
    const r = eigs(matrix(A1238) as never, 1e-8 as never) as unknown as PairResult;
    expect(isMatrix(r.values)).toBe(true);
    expect(worstResidual(A1238, r)).toBeLessThan(1e-13);
  });

  it('30 seeded random 4x4 matrices: no throw and a residual below 1e-12', () => {
    let seed = 1179;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let k = 0; k < 30; k++) {
      const A = Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => Math.round((rnd() * 10 - 5) * 1000) / 1000)
      );
      const r = run(matrix(A));
      expect(worstResidual(A, r)).toBeLessThan(1e-12);
    }
  });

  it('a Matrix of Fractions converges (it takes the native solver, #1179)', () => {
    const A = [
      [0, -1],
      [1, 0],
    ];
    const r = run(matrix(A.map((row) => row.map((x) => fraction(x)))));
    expect(isMatrix(r.values)).toBe(true);
    expect(worstResidual(A, r)).toBeLessThan(1e-12);
  });
});
