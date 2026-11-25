/**
 * Dogfood #1240 (cause C) and #1179 - public `eigs` beside a huge coupling entry, and a matrix of
 * Fractions.
 *
 * - The test that an eigenvalue is real used the Gershgorin rows of the whole matrix. A coupling
 *   entry of 1e15 in the row of the pair +-i made the scale of the pair 1e15, so the pair read as
 *   the real values 0, 0. The test now reads the active block of the balanced matrix
 *   (`balanceForEig` of the matrix package), which is the matrix that the solver reads.
 * - A matrix with Fraction entries (or numbers and one Fraction) went to the factory solver, whose
 *   eigenvectors had a residual of 2.3e-6. The factory solves such a matrix in numbers, so the
 *   native solver now takes it.
 */
import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import { eigs, matrix } from '../src/index.js';

type Ri = { re: number; im: number };
type Pair = { value: unknown; vector: unknown };
type Result = { values: unknown; eigenvectors: Pair[] };

const toRi = (x: unknown): Ri => {
  if (typeof x === 'number') return { re: x, im: 0 };
  const o = x as { re: number; im: number };
  return { re: o.re, im: o.im };
};
const toArray = (x: unknown): unknown[] =>
  Array.isArray(x) ? x : ((x as { toArray(): unknown[] }).toArray() as unknown[]);
const run = (A: unknown, opts?: object): Result =>
  (opts === undefined ? eigs(A as never) : eigs(A as never, opts as never)) as unknown as Result;

/** The largest |A v - l v| / |v| over the eigenpairs of a result. */
function worstResidual(A: number[][], r: Result): number {
  let worst = 0;
  for (const { value, vector } of r.eigenvectors) {
    const l = toRi(value);
    const v = toArray(vector).map(toRi);
    const norm = Math.hypot(...v.map((z) => Math.hypot(z.re, z.im)));
    for (let i = 0; i < A.length; i++) {
      let sr = 0;
      let si = 0;
      for (let j = 0; j < A.length; j++) {
        sr += A[i][j] * v[j].re;
        si += A[i][j] * v[j].im;
      }
      sr -= l.re * v[i].re - l.im * v[i].im;
      si -= l.re * v[i].im + l.im * v[i].re;
      worst = Math.max(worst, Math.hypot(sr, si) / norm);
    }
  }
  return worst;
}

const frobenius = (A: number[][]): number => Math.hypot(...A.flat());
const complexCount = (r: Result): number =>
  toArray(r.values).filter((x) => typeof x !== 'number').length;

describe('eigs keeps the pair +-i beside a coupling entry (#1240, balance)', () => {
  const layouts: Array<[string, (s: number, a: number) => number[][]]> = [
    [
      'row coupling',
      (s, a) => [
        [a, 1, s],
        [-1, a, 0],
        [0, 0, 3],
      ],
    ],
    [
      'column coupling',
      (s, a) => [
        [3, s, 0],
        [0, a, 1],
        [0, -1, a],
      ],
    ],
    [
      'second row coupling',
      (s, a) => [
        [a, 1, 0],
        [-1, a, s],
        [0, 0, 3],
      ],
    ],
    [
      'below the diagonal',
      (s, a) => [
        [3, 0, 0],
        [s, a, 1],
        [0, -1, a],
      ],
    ],
  ];
  for (const [label, make] of layouts) {
    for (const s of [1e10, 1e15, 1e20]) {
      for (const a of [0, 1e-5]) {
        it(`${label}, s = ${s}, pair ${a} +- i`, () => {
          const A = make(s, a);
          const r = run(A);
          const values = toArray(r.values).map(toRi);
          expect(complexCount(r)).toBe(2);
          for (const v of values) {
            if (v.im === 0) expect(v.re).toBeCloseTo(3, 12);
            else {
              expect(Math.abs(v.re - a)).toBeLessThanOrEqual(1e-12);
              expect(Math.abs(Math.abs(v.im) - 1)).toBeLessThanOrEqual(1e-12);
            }
          }
          expect(worstResidual(A, r)).toBeLessThanOrEqual(1e-13 * frobenius(A));
        });
      }
    }
  }
});

/** A seeded linear congruential generator in [0, 1). */
function rng(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

describe('eigs of seeded block-triangular matrices in a random order (#1240)', () => {
  it('finds every pair and every real value of 200 matrices, couplings 1 to 1e20', () => {
    const rnd = rng(12345);
    const int = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
    let right = 0;
    let residualOk = 0;
    for (let t = 0; t < 200; t++) {
      const n = int(3, 6);
      const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
      const truth: Ri[] = [];
      for (let i = 0; i < n;) {
        if (i + 1 < n && rnd() < 0.5) {
          const a = int(-3, 3);
          const b = int(1, 3);
          A[i][i] = a;
          A[i][i + 1] = b;
          A[i + 1][i] = -b;
          A[i + 1][i + 1] = a;
          truth.push({ re: a, im: b }, { re: a, im: -b });
          i += 2;
        } else {
          A[i][i] = int(-5, 5);
          truth.push({ re: A[i][i], im: 0 });
          i++;
        }
      }
      const c = 10 ** int(0, 20);
      for (let r = 0; r < n; r++) {
        for (let q = r + 1; q < n; q++)
          if (A[r][q] === 0 && rnd() < 0.5) A[r][q] = (rnd() - 0.5) * c;
      }
      const p = Array.from({ length: n }, (_, k) => k);
      for (let k = n - 1; k > 0; k--) {
        const j = int(0, k);
        [p[k], p[j]] = [p[j], p[k]];
      }
      const B = p.map((i) => p.map((j) => A[i][j]));
      const r = run(B);
      // Each true value takes the nearest computed value that no other true value took.
      const got = toArray(r.values).map(toRi);
      const close = truth.every((t) => {
        let best = -1;
        got.forEach((v, k) => {
          if (
            best < 0 ||
            Math.hypot(v.re - t.re, v.im - t.im) <
              Math.hypot(got[best].re - t.re, got[best].im - t.im)
          )
            best = k;
        });
        const v = got.splice(best, 1)[0];
        return Math.hypot(v.re - t.re, v.im - t.im) <= 1e-6 * (1 + Math.hypot(t.re, t.im));
      });
      if (close && complexCount(r) === truth.filter((v) => v.im !== 0).length) right++;
      if (worstResidual(B, r) <= 1e-12 * frobenius(B)) residualOk++;
    }
    expect(right).toBe(200);
    expect(residualOk).toBe(200);
  });
});

describe('eigs of a matrix of Fractions takes the native solver (#1179)', () => {
  const TRIAGE3 = [
    [-2.28, -4.27, -4.75],
    [-2.03, 3.95, -0.25],
    [-3, -0.76, 1.39],
  ];
  const fractions = TRIAGE3.map((row) => row.map((x) => new Fraction(x)));
  const mixed = TRIAGE3.map((row, i) =>
    row.map((x, j) => (i === 0 && j === 0 ? new Fraction(x) : x))
  );

  it('a Fraction Array has an eigenvector residual of rounding size', () => {
    const r = run(fractions);
    expect(toArray(r.values)).toHaveLength(3);
    expect(worstResidual(TRIAGE3, r)).toBeLessThan(1e-13);
  });

  it('a Matrix of Fractions has an eigenvector residual of rounding size', () => {
    const r = run(matrix(fractions as never));
    expect(toArray(r.values)).toHaveLength(3);
    expect(worstResidual(TRIAGE3, r)).toBeLessThan(1e-13);
  });

  it('numbers with one Fraction have an eigenvector residual of rounding size', () => {
    const r = run(mixed);
    expect(worstResidual(TRIAGE3, r)).toBeLessThan(1e-13);
  });

  it('gives the values of the number matrix in the factory order, as mathjs 15.2.0 does', () => {
    // |lambda| ascending: mathjs 15.2.0 gives 3.0496, -5.4560, 5.4664 for this Fraction Array.
    const byRe = (p: { re: number }, q: { re: number }): number => p.re - q.re;
    const want = toArray(run(TRIAGE3).values).map(toRi);
    for (const input of [fractions, mixed]) {
      const got = toArray(run(input).values).map(toRi);
      expect(got.map((v) => Math.round(v.re * 1e4) / 1e4)).toEqual([3.0496, -5.456, 5.4664]);
      [...got].sort(byRe).forEach((v, k) => {
        expect(v.re).toBeCloseTo([...want].sort(byRe)[k].re, 12);
        expect(v.im).toBeCloseTo([...want].sort(byRe)[k].im, 12);
      });
    }
    const r = run(fractions);
    expect(r.eigenvectors.map((e) => toRi(e.value).re)).toEqual(
      toArray(r.values).map((v) => toRi(v).re)
    );
  });
});
