import { describe, it, expect } from 'vitest';
import { tanhSinh, clenshawCurtis, dblquad, tplquad } from '../src/numeric/quadrature-extra.js';

describe('tanhSinh', () => {
  it('endpoint singularity 1/sqrt(1-x²) over [-1, 1] = π', () => {
    // Nodes within one ulp of ±1 round onto the endpoint and are skipped; that
    // drops about √(2ε) ≈ 2e-8 of the integrand's mass, so the bound is 5e-8,
    // not 1e-10 (an f(x)-only interface cannot recover that tail).
    expect(tanhSinh((x) => 1 / Math.sqrt(1 - x * x), -1, 1).value).toBeCloseTo(Math.PI, 7);
  });

  it('log singularity ∫_0^1 ln x = -1', () => {
    expect(tanhSinh(Math.log, 0, 1).value).toBeCloseTo(-1, 10);
  });

  it('never evaluates at the endpoints', () => {
    const seen: number[] = [];
    tanhSinh(
      (x) => {
        seen.push(x);
        return 1;
      },
      0,
      1
    );
    expect(seen.every((x) => x > 0 && x < 1)).toBe(true);
  });

  it('rejects infinite limits', () => {
    expect(() => tanhSinh(Math.exp, 0, Infinity)).toThrow(RangeError);
  });
});

describe('clenshawCurtis', () => {
  it('x⁴ over [-1, 1] with n = 8', () => {
    expect(clenshawCurtis((x) => x ** 4, -1, 1, 8)).toBeCloseTo(0.4, 12);
  });

  it('rejects n < 2', () => {
    expect(() => clenshawCurtis(Math.sin, 0, 1, 1)).toThrow(RangeError);
  });
});

describe('dblquad / tplquad', () => {
  it('∫_0^1 ∫_0^1 x y = 0.25', () => {
    expect(dblquad((y, x) => x * y, 0, 1, 0, 1).value).toBeCloseTo(0.25, 10);
  });

  it('area of the unit disk via variable limits = π', () => {
    const r = dblquad(
      () => 1,
      -1,
      1,
      (x) => -Math.sqrt(1 - x * x),
      (x) => Math.sqrt(1 - x * x)
    );
    expect(r.value).toBeCloseTo(Math.PI, 7);
  });

  it('∫∫∫ x y z over the unit cube = 0.125', () => {
    expect(tplquad((z, y, x) => x * y * z, 0, 1, 0, 1, 0, 1).value).toBeCloseTo(0.125, 9);
  });
});

describe('tanhSinh reversed limits', () => {
  it('integrates x^2 from 1 to 0 as -1/3', async () => {
    const { tanhSinh } = await import('../src/numeric/quadrature-extra.js');
    expect(tanhSinh((x) => x * x, 1, 0).value).toBeCloseTo(-1 / 3, 10);
  });
});
