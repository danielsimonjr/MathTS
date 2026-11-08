import { describe, it, expect } from 'vitest';
import * as functions from '../src/index.js';

type Sf2 = (x: number, df: number) => number;
type Sf3 = (x: number, d1: number, d2: number) => number;
const api = functions as unknown as {
  chiSquaredSF: Sf2;
  fSF: Sf3;
  mcnemar: (t: number[][], o?: { correction?: boolean }) => { chi2: number; pValue: number };
};

function rel(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

// scipy.stats chi2.sf / f.sf and statsmodels mcnemar(exact=False, correction=True).
describe('direct upper tails (UPT plan task M2)', () => {
  it('chiSquaredSF matches scipy in the body and the far tail', () => {
    expect(rel(api.chiSquaredSF(3.84, 1), 0.05004352124870519)).toBeLessThan(1e-12);
    expect(rel(api.chiSquaredSF(0.5, 4), 0.9735009788392561)).toBeLessThan(1e-12);
    expect(rel(api.chiSquaredSF(80, 5), 8.391825114831597e-16)).toBeLessThan(1e-10);
    expect(rel(api.chiSquaredSF(200, 3), 4.218541107192018e-43)).toBeLessThan(1e-10);
    expect(api.chiSquaredSF(0, 3)).toBe(1);
  });

  it('fSF matches scipy in the body and the far tail', () => {
    expect(rel(api.fSF(3.0, 2, 10), 0.09536743164062497)).toBeLessThan(1e-12);
    expect(rel(api.fSF(0.5, 4, 9), 0.7369898721925505)).toBeLessThan(1e-12);
    expect(rel(api.fSF(60, 3, 20), 3.527906745405453e-10)).toBeLessThan(1e-10);
    expect(rel(api.fSF(400, 5, 30), 1.6896825424140984e-26)).toBeLessThan(1e-10);
    expect(api.fSF(0, 3, 7)).toBe(1);
  });

  it('mcnemar takes its p-value from the direct tail', () => {
    const body = api.mcnemar([
      [10, 5],
      [3, 12],
    ]);
    expect(body.chi2).toBe(0.125);
    expect(rel(body.pValue, 0.7236736098317629)).toBeLessThan(1e-12);
    const far = api.mcnemar([
      [50, 0],
      [200, 50],
    ]);
    expect(far.chi2).toBeCloseTo(198.005, 12);
    expect(rel(far.pValue, 5.691099965684614e-45)).toBeLessThan(1e-10);
    expect(
      rel(
        api.mcnemar([
          [0, 60],
          [1, 0],
        ]).pValue,
        1.1181346561214534e-13
      )
    ).toBeLessThan(1e-10);
  });
});
