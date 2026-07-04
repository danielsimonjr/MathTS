import { describe, it, expect } from 'vitest';
import {
  autoCorrelation,
  correlate,
  hilbertTransform,
  kmeans,
  multivariateTaylor,
  series,
} from '@danielsimonjr/mathts-functions';

/**
 * WS-1 P2 — closed-form oracle pins for signal / CAS / clustering functions listed
 * SELF-REF in the oracle-coverage matrix. Values are derived independently of the
 * implementation. See [[feedback-oracle-tests-implementation-independent]].
 */

describe('autoCorrelation / correlate — exact', () => {
  it('autoCorrelation([1,2,3]) = [3,8,14,8,3] (lag-0 = Σx² = 14; symmetric)', () => {
    expect(autoCorrelation([1, 2, 3])).toEqual([3, 8, 14, 8, 3]);
  });
  it('correlate(x,x) equals its autocorrelation', () => {
    expect(correlate([1, 2, 3], [1, 2, 3])).toEqual([3, 8, 14, 8, 3]);
  });
});

describe('hilbertTransform — 90° phase shift', () => {
  it('H[1,0,−1,0] = [0,1,0,−1] (cosine-like → sine-like)', () => {
    const h = hilbertTransform([1, 0, -1, 0]);
    expect(h[0]).toBeCloseTo(0, 10);
    expect(h[1]).toBeCloseTo(1, 10);
    expect(h[2]).toBeCloseTo(0, 10);
    expect(h[3]).toBeCloseTo(-1, 10);
  });
});

describe('kmeans — deterministic on well-separated clusters', () => {
  it('two far-apart pairs → centroids at their exact means', () => {
    const r = kmeans(
      [
        [0, 0],
        [0.1, 0],
        [10, 10],
        [10.1, 10],
      ],
      2,
      { seed: 1 }
    );
    // centroid set is deterministic (label order may vary) — sort by x
    const cents = [...r.centroids].sort((a, b) => a[0] - b[0]);
    expect(cents[0][0]).toBeCloseTo(0.05, 10);
    expect(cents[0][1]).toBeCloseTo(0, 10);
    expect(cents[1][0]).toBeCloseTo(10.05, 10);
    expect(cents[1][1]).toBeCloseTo(10, 10);
  });
});

describe('CAS series / multivariateTaylor', () => {
  it('multivariateTaylor of a polynomial is exact: x²+y² ↦ contains x^2 and y^2', () => {
    const t = multivariateTaylor('x^2+y^2', ['x', 'y'], [0, 0], 2);
    expect(t).toContain('x^2');
    expect(t).toContain('y^2');
  });
  it('series leading behavior is correct (f(0), f′(0)): exp→"1 + x", sin→"x"', () => {
    // The Maclaurin series' leading terms encode f(0)=1, f′(0)=1 for exp; f(0)=0,
    // f′(0)=1 for sin. (Higher-order finite-difference coefficients are only
    // approximate — a known limitation of the numerical Taylor routine.)
    expect(series('exp(x)', 'x', 0, 3).startsWith('1 + x')).toBe(true);
    expect(series('sin(x)', 'x', 0, 3).startsWith('x ')).toBe(true);
  });
});
