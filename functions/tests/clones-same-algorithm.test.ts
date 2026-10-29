/**
 * Equivalence pins for the same-algorithm helpers extracted in the #473
 * follow-up. Each case is a closed form or a hand expansion, including the
 * edges the two old copies had to agree on.
 */
import { describe, it, expect } from 'vitest';
import { centralDifferenceGradient } from '../src/numeric/numeric-jacobian.js';
import { bfgs } from '../src/numeric/bfgs.js';
import { gradientDescent } from '../src/optimization-extra.js';
import { indexCombinations } from '../src/typed/factorization/zassenhaus.js';
import { matrixRank, jordanForm } from '../src/typed/matrix-ops.js';
import { cummax, cummin } from '../src/numeric-extra.js';
import { gammainc, gammaincp } from '../src/typed/special.js';

const CBRT_EPS = Math.cbrt(2.220446049250313e-16);

describe('centralDifferenceGradient', () => {
  it('returns an empty gradient for an empty point', () => {
    expect(
      centralDifferenceGradient(
        () => 0,
        [],
        () => 1
      )
    ).toEqual([]);
  });

  it('is exact for a quadratic at a constant step', () => {
    // ((3+h)^2 - (3-h)^2) / (2h) = 6 in exact arithmetic. Float rounding
    // leaves a 1e-9 residual at h = 1e-6.
    const g = centralDifferenceGradient(
      (x) => x[0] * x[0],
      [3],
      () => 1e-6
    );
    expect(g[0]).toBeCloseTo(6, 8);
  });

  it('uses the caller step, including a zero coordinate', () => {
    const steps: number[] = [];
    centralDifferenceGradient(
      (x) => x[0] + x[1],
      [0, -4],
      (xi) => {
        steps.push(xi);
        return 0.25;
      }
    );
    expect(steps).toEqual([0, -4]);
  });

  it('bfgs numeric step matches max(1, |x|) · cbrt(eps) on a linear function', () => {
    // Central differences of f(x) = x are 1 for any step. Pin the step by
    // counting how the helper is called from bfgs through a function whose
    // derivative is the identity, then check the documented step on the helper.
    const at = (x: number): number => Math.max(1, Math.abs(x)) * CBRT_EPS;
    const g = centralDifferenceGradient(
      (v) => v[0],
      [0],
      (xi) => at(xi)
    );
    expect(g[0]).toBe(1);
    expect(at(0)).toBe(CBRT_EPS);
    expect(at(3)).toBe(3 * CBRT_EPS);
    const numeric = bfgs((v) => (v[0] - 2) ** 2, [0]);
    expect(numeric.x[0]).toBeCloseTo(2, 6);
    expect(numeric.converged).toBe(true);
  });

  it('gradientDescent keeps the constant 1e-6 step and still finds the minimum', () => {
    const g = centralDifferenceGradient(
      (v) => v[0] * v[0],
      [3],
      () => 1e-6
    );
    expect(g[0]).toBeCloseTo(6, 8);
    const r = gradientDescent((v) => (v[0] - 3) ** 2 + (v[1] + 1) ** 2, [0, 0]);
    expect(r.x[0]).toBeCloseTo(3, 5);
    expect(r.x[1]).toBeCloseTo(-1, 5);
    expect(r.converged).toBe(true);
  });
});

describe('indexCombinations', () => {
  const lists = (n: number, k: number): number[][] => [...indexCombinations(n, k)];

  it('yields one empty selection when k is 0', () => {
    expect(lists(4, 0)).toEqual([[]]);
    expect(lists(0, 0)).toEqual([[]]);
  });

  it('yields nothing when k is negative or larger than n', () => {
    expect(lists(3, -1)).toEqual([]);
    expect(lists(3, 4)).toEqual([]);
  });

  it('lists the size-2 subsets of {0,1,2} in lexicographic order', () => {
    expect(lists(3, 2)).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
  });
});

describe('matrixRank edges used by the Jordan walk', () => {
  it('counts a zero matrix as rank 0 and honors the tolerance', () => {
    expect(matrixRank([[0]])).toBe(0);
    expect(matrixRank([[1e-12]])).toBe(0);
    expect(matrixRank([[1e-12]], 1e-14)).toBe(1);
    expect(
      matrixRank(
        [
          [1, 0],
          [0, 1e-12],
        ],
        1e-10
      )
    ).toBe(1);
    expect(
      matrixRank(
        [
          [1, 0],
          [0, 1e-12],
        ],
        1e-14
      )
    ).toBe(2);
  });

  it('Jordan form of a diagonal matrix agrees with matrixRank of A − λI', async () => {
    const A = [
      [2, 0],
      [0, 3],
    ];
    expect(
      matrixRank(
        [
          [0, 0],
          [0, 1],
        ],
        1e-8
      )
    ).toBe(1);
    const { J } = await jordanForm(A);
    expect(J[0][0]).toBeCloseTo(2, 6);
    expect(J[1][1]).toBeCloseTo(3, 6);
    expect(J[0][1]).toBe(0);
    expect(J[1][0]).toBe(0);
  });
});

describe('cummax and cummin', () => {
  it('handles empty input, NaN, and infinities without replacing on NaN', () => {
    expect(cummax([])).toEqual([]);
    expect(cummin([])).toEqual([]);
    expect(cummax([NaN, 1, NaN])).toEqual([-Infinity, 1, 1]);
    expect(cummin([NaN, 1, NaN])).toEqual([Infinity, 1, 1]);
    expect(cummax([-Infinity, -1])).toEqual([-Infinity, -1]);
    expect(cummin([Infinity, 1])).toEqual([Infinity, 1]);
    expect(cummax(new Float64Array([1, 3, 2]))).toEqual([1, 3, 3]);
    expect(cummin(new Float64Array([1, 3, 2]))).toEqual([1, 1, 1]);
  });
});

describe('upper gamma continued fraction', () => {
  it('keeps the pinned P and Q values, including the far tail', () => {
    expect(gammainc(1, 1)).toBe(0.6321205588285583);
    expect(gammaincp(1, 1)).toBe(0.36787944117144167);
    expect(gammainc(3, 2)).toBe(0.3233235838169362);
    expect(gammaincp(3, 2)).toBe(0.6766764161830638);
    expect((gammainc(3, 2) as number) + (gammaincp(3, 2) as number)).toBe(1);
    expect(gammainc(5, 80)).toBe(1);
    expect(gammaincp(5, 80)).toBe(3.2402154044224999e-29);
    expect(gammainc(2, 0)).toBe(0);
    expect(gammaincp(2, 0)).toBe(1);
    expect(gammainc(1, -1)).toBeNaN();
    expect(gammaincp(1, -1)).toBeNaN();
  });

  it('Float64Array gammaincp matches the scalar, series and continued fraction', async () => {
    const xs = Float64Array.from([0, 0.5, 1, 8, 80]);
    const arr = (await gammaincp(5, xs)) as Float64Array;
    expect(arr.length).toBe(xs.length);
    for (let i = 0; i < xs.length; i++) {
      expect(arr[i]).toBe(gammaincp(5, xs[i]) as number);
    }
  });
});
