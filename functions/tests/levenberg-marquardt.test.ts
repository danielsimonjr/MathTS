import { describe, it, expect } from 'vitest';
import { levenbergMarquardt, curvefit } from '../src/index.js';
import { norm2 } from '@danielsimonjr/mathts-core';

/**
 * Oracle checks for the consolidated LM implementation (forward h=1e-7 Jacobian,
 * pairwiseDot cost). References are closed forms or independent formulas, not
 * copies of the implementation under test.
 */
describe('levenbergMarquardt — oracle fits', () => {
  it('recovers exact linear-in-parameters model y = 2x + 3', () => {
    const xs = [0, 1, 2, 3];
    const ys = xs.map((x) => 2 * x + 3);
    const r = levenbergMarquardt((p) => xs.map((x, i) => p[0] * x + p[1] - ys[i]), [0, 0]);
    expect(r.x[0]).toBeCloseTo(2, 10);
    expect(r.x[1]).toBeCloseTo(3, 10);
    expect(r.residualNorm).toBeLessThan(1e-10);
  });

  it('recovers Gaussian peak parameters (planted)', () => {
    const a = 3;
    const mu = 1.5;
    const sigma = 0.8;
    const xs = [-1, 0, 0.5, 1, 1.5, 2, 2.5];
    const ys = xs.map((x) => a * Math.exp(-0.5 * ((x - mu) / sigma) ** 2));
    const r = levenbergMarquardt(
      (p) =>
        xs.map((x, i) => p[0] * Math.exp(-0.5 * ((x - p[1]) / Math.max(p[2], 1e-6)) ** 2) - ys[i]),
      [1, 0, 0.5]
    );
    expect(r.x[0]).toBeCloseTo(a, 4);
    expect(r.x[1]).toBeCloseTo(mu, 4);
    expect(r.x[2]).toBeCloseTo(sigma, 4);
  });

  it('recovers the Rosenbrock residual root (1, 1)', () => {
    // r = [1 − x, 10(y − x²)]; unique zero at the planted (1, 1).
    const r = levenbergMarquardt((v) => [1 - v[0], 10 * (v[1] - v[0] ** 2)], [-1.2, 1]);
    expect(r.x[0]).toBe(1);
    expect(r.x[1]).toBe(1);
    expect(r.residualNorm).toBe(0);
  });

  it('starts at zero residual (already at the root)', () => {
    const r = levenbergMarquardt((x) => [x[0] - 5, x[1] + 2], [5, -2]);
    expect(r.x[0]).toBeCloseTo(5, 12);
    expect(r.x[1]).toBeCloseTo(-2, 12);
    expect(r.residualNorm).toBe(0);
  });

  it('single-parameter least squares', () => {
    const ys = [1, 2, 3, 4];
    const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
    const r = levenbergMarquardt((p) => ys.map((y) => p[0] - y), [0]);
    expect(r.x[0]).toBeCloseTo(mean, 9);
    // Recorded from origin/main (iterate pin: parameters, cost, iteration count).
    expect(r.x[0]).toBe(2.499999999907543);
    expect(r.residualNorm).toBe(2.23606797749979);
    expect(r.iterations).toBe(2);
    expect(r.converged).toBe(true);
  });
});

describe('levenbergMarquardt — edge behaviour', () => {
  it('reports converged false when maxIter is exhausted', () => {
    const r = levenbergMarquardt((x) => [Math.sin(x[0])], [10], { maxIter: 1, tol: 1e-20 });
    expect(r.iterations).toBe(1);
    expect(r.converged).toBe(false);
    // Recorded from origin/main's private forward Jacobian + reduce cost (iterate pin).
    expect(r.x[0]).toBe(9.35228686068394);
    expect(r.residualNorm).toBe(0.0724276271315095);
  });

  it('does not throw when residuals become NaN (returns a finite or NaN state)', () => {
    const r = levenbergMarquardt((x) => [Math.sqrt(x[0])], [-1], { maxIter: 5 });
    expect(Number.isNaN(r.residualNorm) || r.residualNorm >= 0).toBe(true);
  });

  it('handles rank-deficient Jacobian (collinear parameters) without throwing', () => {
    const xs = [1, 2, 3];
    const ys = [2, 4, 6];
    const r = levenbergMarquardt((p) => xs.map((x, i) => (p[0] + p[1]) * x - ys[i]), [0, 0], {
      maxIter: 50,
    });
    const pred = xs.map((x) => r.x[0] * x + r.x[1] * x);
    for (let i = 0; i < xs.length; i++) {
      expect(pred[i]).toBeCloseTo(ys[i], 6);
    }
  });
});

describe('curvefit wrapper', () => {
  it('matches levenbergMarquardt on the same exponential fixture', () => {
    const xs = [0, 0.5, 1, 1.5, 2];
    const ys = xs.map((x) => 1.2 * Math.exp(-0.3 * x));
    const viaCurve = curvefit((x, p) => p[0] * Math.exp(p[1] * x), xs, ys, [1, -0.1]);
    const viaLm = levenbergMarquardt(
      (p) => xs.map((x, i) => ys[i] - p[0] * Math.exp(p[1] * x)),
      [1, -0.1],
      { maxIter: 200, tol: 1e-12 }
    ).x;
    expect(viaCurve[0]).toBeCloseTo(viaLm[0], 12);
    expect(viaCurve[1]).toBeCloseTo(viaLm[1], 12);
  });
});

describe('svds normalization uses scaled norm2', () => {
  it('norm2 of huge vector matches scaled reference (core oracle)', () => {
    const v = [1e200, 1e200, 1e200, 1e200];
    const scaled = v.map((x) => x / 1e200);
    const ref = 1e200 * norm2(scaled);
    expect(norm2(v)).toBe(ref);
    expect(norm2(v)).toBe(2e200);
  });
});
