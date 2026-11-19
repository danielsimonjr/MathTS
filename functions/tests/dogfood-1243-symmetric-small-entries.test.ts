import { describe, it, expect } from 'vitest';
import type BigNumber from 'bignumber.js';
import { eigs as eigsRaw, bignumber, matrix } from '../src/index.js';

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
});
