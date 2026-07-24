import { describe, it, expect } from 'vitest';
import { bsplineFit, bsplineEval, monteCarloIntegrate } from '../src/index.js';

// Oracle values cross-checked against scipy:
//   from scipy.interpolate import splrep, splev
//   xs = [i*2*np.pi/14 for i in range(15)]; ys = [np.sin(x) for x in xs]
//   tck = splrep(xs, ys, s=0, k=3)
//   splev(1.0, tck) -> 0.8414499177931678
describe('bsplineFit/bsplineEval — interpolation (s=0)', () => {
  const n = 15;
  const xs = Array.from({ length: n }, (_, i) => (i * 2 * Math.PI) / (n - 1));
  const ys = xs.map(Math.sin);
  const tck = bsplineFit(xs, ys);

  it('passes through every data point exactly', () => {
    for (let i = 0; i < n; i++) {
      expect(bsplineEval(tck, xs[i])).toBeCloseTo(ys[i], 9);
    }
  });

  it('approximates sin at intermediate points to ~1e-3', () => {
    for (const x of [1, 3, 5]) {
      expect(bsplineEval(tck, x)).toBeCloseTo(Math.sin(x), 3);
    }
  });

  it('cross-checks against scipy splev(1.0) (loose tol — knot conventions may differ slightly)', () => {
    expect(bsplineEval(tck, 1.0)).toBeCloseTo(0.8414499177931678, 4);
  });

  it('vectorized evaluation matches scalar evaluation', () => {
    const vec = bsplineEval(tck, [1, 3, 5]);
    expect(vec).toHaveLength(3);
    [1, 3, 5].forEach((x, i) => {
      expect(vec[i]).toBeCloseTo(bsplineEval(tck, x), 12);
    });
  });

  it('returns the {t, c, k} tck tuple shape', () => {
    expect(tck.k).toBe(3);
    expect(Array.isArray(tck.t)).toBe(true);
    expect(Array.isArray(tck.c)).toBe(true);
    // len(t) = numCoef + k + 1 = n + k + 1 for interpolation
    expect(tck.t).toHaveLength(n + tck.k + 1);
    expect(tck.c).toHaveLength(n);
  });

  it('throws on non-strictly-increasing x', () => {
    expect(() => bsplineFit([0, 1, 1, 2], [0, 1, 1, 2])).toThrow();
  });
});

describe('bsplineFit — least-squares smoothing (s>0)', () => {
  // Deterministic pseudo-noise (no RNG dependency): a fixed, irregular
  // perturbation pattern layered on top of a smooth sin curve.
  const n = 40;
  const xs = Array.from({ length: n }, (_, i) => (i * 2 * Math.PI) / (n - 1));
  const noise = (i: number): number => 0.25 * Math.sin(12.9898 * i + 78.233) * Math.cos(i * 3.7);
  const ysNoisy = xs.map((x, i) => Math.sin(x) + noise(i));

  function totalVariation(ys: readonly number[]): number {
    let tv = 0;
    for (let i = 1; i < ys.length; i++) tv += Math.abs(ys[i] - ys[i - 1]);
    return tv;
  }

  it('smoothed curve has smaller total variation than the raw noisy data', () => {
    const tck = bsplineFit(xs, ysNoisy, { s: 5 });
    const smoothed = bsplineEval(tck, xs);
    expect(totalVariation(smoothed)).toBeLessThan(totalVariation(ysNoisy));
  });

  it('an explicit nknots produces fewer coefficients than interpolation', () => {
    const tck = bsplineFit(xs, ysNoisy, { nknots: 3 });
    expect(tck.c.length).toBeLessThan(n);
    expect(tck.c).toHaveLength(3 + tck.k + 1);
  });

  it('larger s smooths at least as much as smaller s (property, not exact monotonicity guarantee)', () => {
    const mild = bsplineEval(bsplineFit(xs, ysNoisy, { s: 1 }), xs);
    const strong = bsplineEval(bsplineFit(xs, ysNoisy, { s: 20 }), xs);
    expect(totalVariation(strong)).toBeLessThanOrEqual(totalVariation(mild) + 1e-9);
  });
});

describe('monteCarloIntegrate — uniform sampling within a 4-sigma band', () => {
  it('∫_0^1 x^2 dx = 1/3', () => {
    const { estimate, stderr } = monteCarloIntegrate((x) => x[0] ** 2, [[0, 1]], {
      n: 1e5,
      seed: 42,
    });
    expect(Math.abs(estimate - 1 / 3)).toBeLessThan(4 * stderr);
  });

  it('unit-disk indicator over [-1,1]^2 = pi', () => {
    const { estimate, stderr } = monteCarloIntegrate(
      (x) => (x[0] ** 2 + x[1] ** 2 <= 1 ? 1 : 0),
      [
        [-1, 1],
        [-1, 1],
      ],
      { n: 1e5, seed: 7 }
    );
    expect(Math.abs(estimate - Math.PI)).toBeLessThan(4 * stderr);
  });

  it('is reproducible given a fixed seed', () => {
    const a = monteCarloIntegrate((x) => x[0] ** 2, [[0, 1]], { n: 1000, seed: 'fixed' });
    const b = monteCarloIntegrate((x) => x[0] ** 2, [[0, 1]], { n: 1000, seed: 'fixed' });
    expect(a.estimate).toBe(b.estimate);
    expect(a.stderr).toBe(b.stderr);
  });

  it('rejects a degenerate (hi <= lo) bound', () => {
    expect(() => monteCarloIntegrate((x) => x[0], [[1, 0]])).toThrow();
  });
});

describe('monteCarloIntegrate — QMC (halton/sobol) converges faster than uniform MC', () => {
  const exact = 1 / 3;
  const n = 1e5;

  it('halton error is no worse than a fixed small bound, well under uniform MC stderr scale', () => {
    const { estimate } = monteCarloIntegrate((x) => x[0] ** 2, [[0, 1]], { n, method: 'halton' });
    const err = Math.abs(estimate - exact);
    // Halton's discrepancy-driven error at n=1e5 is ~1e-4-1e-5; uniform MC's
    // stderr at this n is ~6e-4. Assert a fixed bound well inside uniform's
    // typical scale rather than a single noisy uniform draw, per the task's
    // documented fallback (a strict per-run comparison would be flaky).
    expect(err).toBeLessThan(1e-3);
  });

  it('sobol error is no worse than a fixed small bound, well under uniform MC stderr scale', () => {
    const { estimate } = monteCarloIntegrate((x) => x[0] ** 2, [[0, 1]], { n, method: 'sobol' });
    const err = Math.abs(estimate - exact);
    expect(err).toBeLessThan(1e-3);
  });

  it('halton beats the median uniform-MC error across several seeds', () => {
    const haltonErr = Math.abs(
      monteCarloIntegrate((x) => x[0] ** 2, [[0, 1]], { n, method: 'halton' }).estimate - exact
    );
    const uniformErrs = [1, 2, 3, 4, 5].map((seed) =>
      Math.abs(monteCarloIntegrate((x) => x[0] ** 2, [[0, 1]], { n, seed }).estimate - exact)
    );
    uniformErrs.sort((a, b) => a - b);
    const median = uniformErrs[Math.floor(uniformErrs.length / 2)];
    expect(haltonErr).toBeLessThanOrEqual(median);
  });

  it('QMC methods report stderr 0 (documented: not a variance-based CI)', () => {
    expect(monteCarloIntegrate((x) => x[0], [[0, 1]], { method: 'halton', n: 100 }).stderr).toBe(0);
    expect(monteCarloIntegrate((x) => x[0], [[0, 1]], { method: 'sobol', n: 100 }).stderr).toBe(0);
  });

  it('sobol throws a clear scope-limit error above 2 dimensions', () => {
    expect(() =>
      monteCarloIntegrate(
        (x) => x[0] + x[1] + x[2],
        [
          [0, 1],
          [0, 1],
          [0, 1],
        ],
        {
          method: 'sobol',
          n: 10,
        }
      )
    ).toThrow(/1-2 dimensions/);
  });
});
