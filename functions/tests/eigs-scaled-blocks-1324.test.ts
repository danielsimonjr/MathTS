import { describe, expect, it } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { bignumber, complex, eigs } from '../src/index.js';

type SpectralValue = number | { re: number; im: number } | { toNumber(): number };
type EigenResult = {
  values: SpectralValue[];
  eigenvectors: { value: SpectralValue; vector: SpectralValue[] }[];
};
const solve = eigs as (rows: unknown[][]) => EigenResult;

function asComplex(value: SpectralValue): Complex {
  if (typeof value === 'number') return new Complex(value);
  return 're' in value ? new Complex(value.re, value.im) : new Complex(value.toNumber());
}

function scale(value: Complex, factor: number): Complex {
  return new Complex(value.re * factor, value.im * factor);
}

describe('eigs isolates exact diagonal blocks (#1324)', () => {
  it.each([1e200, 1e250, 1e280, 1e300])('keeps ±i beside %s for boxed scalars', (s) => {
    const a = [
      [s, 0, 0],
      [0, 0, 1],
      [0, -1, 0],
    ];
    for (const scalar of [bignumber, complex]) {
      const result = solve(a.map((row) => row.map((x) => scalar(x))));
      const values = result.values.map(asComplex).sort((a, b) => a.im - b.im);
      expect(values[0].im).toBeCloseTo(-1, 14);
      expect(values[1].re).toBe(s);
      expect(values[2].im).toBeCloseTo(1, 14);
      expect(result.eigenvectors).toHaveLength(3);
      for (const { value, vector } of result.eigenvectors) {
        const lambda = asComplex(value);
        const v = vector.map(asComplex);
        const residuals = [
          scale(v[0], s).sub(v[0].mul(lambda)),
          v[2].sub(v[1].mul(lambda)),
          v[1].neg().sub(v[2].mul(lambda)),
        ];
        expect(Math.hypot(...residuals.map((entry) => entry.abs()))).toBeLessThan(1e-12);
      }
    }
  });
});

describe('eigs scales extreme genuine Complex matrices (#1300)', () => {
  it.each([1e150, 1e200, 1e-200])('keeps eigenpairs at scale %s', (s) => {
    const base = [
      [new Complex(2, 1), new Complex(1)],
      [new Complex(0, 1), new Complex(3, -1)],
    ];
    const result = solve(base.map((row) => row.map((x) => scale(x, s))));
    const values = result.values
      .map((value) => scale(asComplex(value), 1 / s))
      .sort((a, b) => a.im - b.im);
    expect(values.map((value) => value.re)).toEqual([
      expect.closeTo(2.5, 13),
      expect.closeTo(2.5, 13),
    ]);
    expect(values[0].im).toBeCloseTo(-Math.sqrt(3) / 2, 13);
    expect(values[1].im).toBeCloseTo(Math.sqrt(3) / 2, 13);
    expect(result.eigenvectors).toHaveLength(2);
    for (const { value, vector } of result.eigenvectors) {
      const lambda = scale(asComplex(value), 1 / s);
      const v = vector.map(asComplex);
      for (let i = 0; i < 2; i++) {
        const r = base[i][0].mul(v[0]).add(base[i][1].mul(v[1])).sub(lambda.mul(v[i]));
        expect(r.abs()).toBeLessThan(1e-12);
      }
    }
  });
});
