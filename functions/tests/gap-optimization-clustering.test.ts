import { describe, it, expect } from 'vitest';
import {
  nelderMead,
  gradientDescent,
  levenbergMarquardt,
  kmeans,
  spectralClustering,
} from '@danielsimonjr/mathts-functions';

/**
 * Named optimizers + clustering (gap analysis, remaining items). Verified against
 * analytic optima and known cluster structure (cross-checked against
 * scipy.optimize / scipy.cluster during development).
 */
describe('gap — named optimizers', () => {
  it('nelderMead minimizes the Rosenbrock function to (1,1)', () => {
    const r = nelderMead((v) => (1 - v[0]) ** 2 + 100 * (v[1] - v[0] ** 2) ** 2, [-1.2, 1], {
      tol: 1e-10,
      maxIter: 5000,
    });
    expect(r.x[0]).toBeCloseTo(1, 3);
    expect(r.x[1]).toBeCloseTo(1, 3);
    expect(r.fx).toBeLessThan(1e-8);
  });

  it('gradientDescent finds the minimum of a quadratic', () => {
    const r = gradientDescent((v) => (v[0] - 3) ** 2 + (v[1] + 1) ** 2, [0, 0]);
    expect(r.x[0]).toBeCloseTo(3, 4);
    expect(r.x[1]).toBeCloseTo(-1, 4);
  });

  it('levenbergMarquardt recovers exponential-fit parameters', () => {
    const t = [0, 0.5, 1, 1.5, 2, 2.5, 3];
    const y = t.map((ti) => 2.5 * Math.exp(0.5 * ti));
    const r = levenbergMarquardt((p) => t.map((ti, i) => p[0] * Math.exp(p[1] * ti) - y[i]), [1, 1]);
    expect(r.x[0]).toBeCloseTo(2.5, 6);
    expect(r.x[1]).toBeCloseTo(0.5, 6);
    expect(r.residualNorm).toBeLessThan(1e-6);
  });
});

describe('gap — clustering', () => {
  it('kmeans separates two well-isolated blobs (deterministic)', () => {
    const blobs = [
      [0, 0],
      [0.5, 0.3],
      [0.2, -0.1],
      [10, 10],
      [10.3, 9.8],
      [9.7, 10.2],
    ];
    const { labels, inertia } = kmeans(blobs, 2);
    expect(labels[0]).toBe(labels[1]);
    expect(labels[1]).toBe(labels[2]);
    expect(labels[3]).toBe(labels[4]);
    expect(labels[0]).not.toBe(labels[3]);
    expect(inertia).toBeLessThan(1); // tight clusters
  });

  it('spectralClustering separates two communities joined by a weak edge', () => {
    const A = [
      [0, 1, 1, 0, 0, 0],
      [1, 0, 1, 0, 0, 0],
      [1, 1, 0, 0.1, 0, 0],
      [0, 0, 0.1, 0, 1, 1],
      [0, 0, 0, 1, 0, 1],
      [0, 0, 0, 1, 1, 0],
    ];
    const c = spectralClustering(A, 2);
    expect(c[0]).toBe(c[1]);
    expect(c[1]).toBe(c[2]);
    expect(c[3]).toBe(c[4]);
    expect(c[4]).toBe(c[5]);
    expect(c[0]).not.toBe(c[3]);
  });
});
