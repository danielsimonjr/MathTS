import { describe, it, expect } from 'vitest';
import type BigNumber from 'bignumber.js';
import { eigs as eigsRaw, bignumber, complex, matrix } from '../src/index.js';

type EigResult = { values: unknown; eigenvectors?: { value: unknown; vector: unknown }[] };
const eigs = eigsRaw as unknown as (m: unknown, o?: object) => EigResult;

const bn = (x: number | string) => bignumber(x) as BigNumber;
const num = (x: unknown): number =>
  typeof x === 'number' ? x : (x as { toNumber: () => number }).toNumber();

// symmetric, no repeated eigenvalues, off-diagonals are as large as the diagonal
const BASE = [
  [4, 1, 2],
  [1, 3, 0.5],
  [2, 0.5, 5],
];
const SCALES_NUMBER = [2 ** -600, 2 ** -60, 1, 2 ** 60, 2 ** 600];
const SCALES_BIG = ['1e-1000', '1e-18', '1', '1e18', '1e1000'];

function vecArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : (v as { toArray: () => unknown[] }).toArray();
}

describe('eigs of real symmetric matrices with small or large entries (#1243)', () => {
  const ref = (
    eigs(matrix(BASE), { eigenvectors: false }).values as unknown as { toArray(): number[] }
  ).toArray();

  for (const c of SCALES_NUMBER) {
    it(`number matrix scaled by ${c} gives c * eigs(A)`, () => {
      const A = BASE.map((r) => r.map((x) => x * c));
      const { values, eigenvectors } = eigs(matrix(A));
      const vals = (values as unknown as { toArray(): number[] }).toArray();
      vals.forEach((v, k) =>
        expect(Math.abs(v - ref[k] * c)).toBeLessThanOrEqual(1e-10 * Math.abs(ref[k] * c))
      );
      for (const { value, vector } of eigenvectors!) {
        const v = vecArr(vector).map(num);
        for (let i = 0; i < 3; i++) {
          const av = A[i].reduce((s, a, j) => s + a * v[j], 0);
          expect(Math.abs(av - num(value) * v[i])).toBeLessThanOrEqual(1e-10 * c * 4.5);
        }
      }
    });
  }

  for (const cs of SCALES_BIG) {
    it(`BigNumber matrix scaled by ${cs} gives c * eigs(A)`, () => {
      const c = bn(cs);
      const A = BASE.map((r) => r.map((x) => bn(x).times(c)));
      const { values, eigenvectors } = eigs(matrix(A));
      const vals = (values as unknown as { toArray(): BigNumber[] }).toArray();
      vals.forEach((v, k) => {
        const want = c.times(ref[k]);
        expect(v.minus(want).abs().lte(want.abs().times('1e-10'))).toBe(true);
      });
      for (const { value, vector } of eigenvectors!) {
        const v = vecArr(vector) as BigNumber[];
        for (let i = 0; i < 3; i++) {
          let av = bn(0);
          for (let j = 0; j < 3; j++) av = av.plus(A[i][j].times(v[j]));
          const r = av.minus((value as BigNumber).times(v[i])).abs();
          expect(r.lte(c.times('4.5e-10'))).toBe(true);
        }
      }
    });
  }

  it('a zero matrix still returns zeros', () => {
    const { values } = eigs(
      matrix([
        [0, 0],
        [0, 0],
      ])
    );
    expect((values as unknown as { toArray(): number[] }).toArray()).toEqual([0, 0]);
  });

  it('a diagonal matrix keeps its diagonal at tiny scale', () => {
    const c = 2 ** -60;
    const { values } = eigs(
      matrix([
        [3 * c, 0],
        [0, c],
      ])
    );
    expect((values as unknown as { toArray(): number[] }).toArray()).toEqual([c, 3 * c]);
  });

  it('a uniformly tiny matrix rotates (positive control)', () => {
    const { values } = eigs(
      matrix([
        [2e-14, 1e-14],
        [1e-14, 2e-14],
      ]),
      { eigenvectors: false }
    );
    const v = (values as unknown as { toArray(): number[] }).toArray();
    expect(Math.abs(v[0] - 1e-14)).toBeLessThanOrEqual(1e-8 * 1e-14);
    expect(Math.abs(v[1] - 3e-14)).toBeLessThanOrEqual(1e-8 * 3e-14);
  });

  // a small block beside a unit entry: exact small eigenvalues 0.9e-12, 1.1e-12
  const GRADED = [
    [1, 0, 0],
    [0, 1e-12, 1e-13],
    [0, 1e-13, 1e-12],
  ];
  const GRADED_WANT = [0.9e-12, 1.1e-12, 1];

  it('a graded number matrix keeps the small eigenvalues to relative 1e-8', () => {
    const { values, eigenvectors } = eigs(matrix(GRADED));
    const v = (values as unknown as { toArray(): number[] }).toArray();
    v.forEach((x, k) =>
      expect(Math.abs(x - GRADED_WANT[k])).toBeLessThanOrEqual(1e-8 * GRADED_WANT[k])
    );
    for (const { value, vector } of eigenvectors!) {
      const u = vecArr(vector).map(num);
      const lam = num(value);
      if (lam > 0.5) continue;
      // residual of the small block, relative to its own scale (1e-12)
      for (let i = 0; i < 3; i++) {
        const av = GRADED[i].reduce((s, a, j) => s + a * u[j], 0);
        expect(Math.abs(av - lam * u[i])).toBeLessThanOrEqual(1e-8 * 1e-12);
      }
    }
  });

  it('a graded BigNumber matrix keeps the small eigenvalues to relative 1e-8', () => {
    const A = GRADED.map((r) => r.map((x) => bn(x)));
    const { values } = eigs(matrix(A), { eigenvectors: false });
    const v = (values as unknown as { toArray(): BigNumber[] }).toArray();
    v.forEach((x, k) => {
      const want = bn(GRADED_WANT[k]);
      expect(x.minus(want).abs().lte(want.times('1e-8'))).toBe(true);
    });
  });

  it('a graded block with unequal diagonals converges', () => {
    // small block [[1e-12, 1e-13], [1e-13, 1.5e-12]]
    const { values } = eigs(
      matrix([
        [1, 0, 0],
        [0, 1e-12, 1e-13],
        [0, 1e-13, 1.5e-12],
      ]),
      { eigenvectors: false }
    );
    const v = (values as unknown as { toArray(): number[] }).toArray();
    const m = 1.25e-12;
    const d = Math.sqrt(0.25e-12 ** 2 + 1e-13 ** 2);
    expect(Math.abs(v[0] - (m - d))).toBeLessThanOrEqual(1e-8 * (m - d));
    expect(Math.abs(v[1] - (m + d))).toBeLessThanOrEqual(1e-8 * (m + d));
  });

  it('singular and zero-diagonal matrices terminate', () => {
    const cases = [
      [
        [1, 1],
        [1, 1],
      ],
      [
        [0, 1],
        [1, 0],
      ],
      Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => (i + 1) * (j + 1))),
    ];
    for (const A of cases) expect(() => eigs(matrix(A))).not.toThrow();
  });

  it('NaN or Infinity entries throw instead of returning garbage', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(() =>
        eigs(
          matrix([
            [1, bad],
            [bad, 2],
          ])
        )
      ).toThrow(/finite/);
      expect(() =>
        eigs(
          matrix([
            [1, bad],
            [3, 2],
          ])
        )
      ).toThrow(/finite/);
    }
    expect(() =>
      eigs(
        matrix([
          [bn(1), bn('Infinity')],
          [bn('Infinity'), bn(2)],
        ])
      )
    ).toThrow(/finite/);
  });
});

describe('eigs of a real symmetric matrix: termination at the limits of the arithmetic (#1243)', () => {
  // rank 2, integer entries: zero is a repeated eigenvalue
  const RANK2 = [
    [8, 6, -4, -2, -2, 6, -2, 0, -4],
    [6, 5, -3, 0, -1, 5, -2, 1, -3],
    [-4, -3, 2, 1, 1, -3, 1, 0, 2],
    [-2, 0, 1, 5, 2, 0, -1, 3, 1],
    [-2, -1, 1, 2, 1, -1, 0, 1, 1],
    [6, 5, -3, 0, -1, 5, -2, 1, -3],
    [-2, -2, 1, -1, 0, -2, 1, -1, 1],
    [0, 1, 0, 3, 1, 1, -1, 2, 0],
    [-4, -3, 2, 1, 1, -3, 1, 0, 2],
  ];

  it('a subnormal matrix terminates (the scaled tolerances underflow to 0)', () => {
    // every entry is a multiple of 1e-322, about 20 subnormal units
    const A = RANK2.map((r) => r.map((x) => x * 1e-322));
    const { values } = eigs(matrix(A), { eigenvectors: false });
    const v = (values as unknown as { toArray(): number[] }).toArray();
    expect(v).toHaveLength(9);
    // the two nonzero eigenvalues of RANK2 are 8.3411 and 22.6589; a
    // subnormal entry holds about one digit
    const big = v.map((x) => x / 1e-322).sort((a, b) => a - b);
    expect(Math.abs(big[8] - 22.6589)).toBeLessThan(1);
    expect(Math.abs(big[7] - 8.3411)).toBeLessThan(1);
  });

  it('a precision of 0 terminates for a number matrix with repeated eigenvalues', () => {
    // H D H with H a Householder reflection: eigenvalues 1, 1, 1, 2, 2, 2
    const u = [1, 2, 3, 4, 5, 6];
    const d = [1, 1, 1, 2, 2, 2];
    const H = (i: number, j: number) => (i === j ? 1 : 0) - (2 * u[i] * u[j]) / 91;
    const A = u.map((_, i) =>
      u.map((_, j) => d.reduce((s, dk, k) => s + H(i, k) * dk * H(k, j), 0))
    );
    for (let i = 0; i < 6; i++) for (let j = 0; j < i; j++) A[i][j] = A[j][i];
    const { values } = eigs(matrix(A), { precision: 0, eigenvectors: false });
    const v = (values as unknown as { toArray(): number[] }).toArray();
    v.forEach((x, k) => expect(Math.abs(x - d[k])).toBeLessThanOrEqual(1e-13));
  });

  it('a precision of 0 terminates for a BigNumber matrix', () => {
    const A = BASE.map((r) => r.map((x) => bn(x)));
    const { values } = eigs(matrix(A), { precision: 0, eigenvectors: false });
    const v = (values as unknown as { toArray(): BigNumber[] }).toArray();
    // trace and the largest eigenvalue to 50 digits
    expect(v[0].plus(v[1]).plus(v[2]).minus(12).abs().lte('1e-50')).toBe(true);
    expect(
      v[2].minus('6.83125443069820580058908911442726483293763676996782').abs().lte('1e-49')
    ).toBe(true);
  });

  it('a rank-1 BigNumber matrix terminates and keeps its eigenvalue', () => {
    const A = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => bn((i + 1) * (j + 1)))
    );
    const { values } = eigs(matrix(A), { eigenvectors: false });
    const v = (values as unknown as { toArray(): BigNumber[] }).toArray();
    expect(v[5].minus(91).abs().lte('1e-55')).toBe(true);
    for (let k = 0; k < 5; k++) expect(v[k].abs().lte('1e-55')).toBe(true);
  });

  it('a block beside a huge diagonal entry keeps its eigenvalues', () => {
    // the rounding floor is relative to the off-diagonal entries, not to 1e16
    for (const huge of [1e16, 1e20]) {
      const { values } = eigs(
        matrix([
          [huge, 0, 0],
          [0, 2, 1],
          [0, 1, 2],
        ]),
        { eigenvectors: false }
      );
      const v = (values as unknown as { toArray(): number[] }).toArray();
      expect(Math.abs(v[0] - 1)).toBeLessThanOrEqual(1e-12);
      expect(Math.abs(v[1] - 3)).toBeLessThanOrEqual(1e-12);
      expect(v[2]).toBe(huge);
    }
    const { values } = eigs(
      matrix([
        [1e20, 0, 0],
        [0, 1e-5, 1],
        [0, 1, 1e-5],
      ]),
      { eigenvectors: false }
    );
    const w = (values as unknown as { toArray(): number[] }).toArray();
    expect(Math.abs(w[0] + 0.99999)).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(w[1] - 1.00001)).toBeLessThanOrEqual(1e-12);
    const B = [
      [bn('1e70'), bn(0), bn(0)],
      [bn(0), bn(2), bn(1)],
      [bn(0), bn(1), bn(2)],
    ];
    const big = (
      eigs(matrix(B), { eigenvectors: false }).values as unknown as { toArray(): BigNumber[] }
    ).toArray();
    expect(big[0].minus(1).abs().lte('1e-50')).toBe(true);
    expect(big[1].minus(3).abs().lte('1e-50')).toBe(true);
  });

  it('a Complex entry with a NaN or infinite part throws', () => {
    for (const bad of [complex(1, NaN), complex(Infinity, 0), complex(0, -Infinity)]) {
      expect(() =>
        eigs(
          matrix([
            [bad, 1],
            [3, 2],
          ])
        )
      ).toThrow(/finite/);
      expect(() =>
        eigs([
          [bad, 1],
          [3, 2],
        ])
      ).toThrow(RangeError);
    }
  });
});
