/**
 * Coverage tests for functions/src/typed/dist-objects.ts.
 *
 * The existing dist-objects.test.ts covers the headline pdf/cdf/mean/variance
 * paths, and typed-dist-objects-workers.test.ts exercises sampleN — but only
 * the JS-fallback branch (it never initializes computePool, so isReady() is
 * false and the worker dispatch lines never run).
 *
 * This suite fills the remaining gaps:
 *  - the worker-dispatch branch of _sampleNDispatch (pool initialized, n ≥ 100k)
 *  - every distribution's synchronous sample() generator
 *  - the JS-loop sampleN path for distributions without a worker kernel
 *  - pdf/cdf/quantile edge branches (boundary returns, Infinity at 0, etc.)
 *  - internal helper branches: _lgamma reflection (x < 0.5), _betainc symmetry,
 *    _logFactorial Stirling (n > 20), _gammaRandom alpha < 1.
 *
 * All assertions check real statistical values (closed-form means/variances,
 * known pdf/cdf points, monotonicity, sample-domain validity).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  normalDist,
  betaDist,
  binomialDist,
  chiSquaredDist,
  exponentialDist,
  fDist,
  gammaDist,
  logNormalDist,
  poissonDist,
  tDist,
  uniformDist,
  weibullDist,
  DIST_WORKER_THRESHOLD,
} from '../src/typed/dist-objects.js';
import { computePool } from '@danielsimonjr/mathts-parallel';

function arrMean(a: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

// ===========================================================================
// Worker-dispatch path: pool initialized + n ≥ DIST_WORKER_THRESHOLD
//
// De-flake note: every test below dispatches ≥100k samples to the worker pool.
// The results are deterministic for a given seed (the fan-out derives per-chunk
// seeds from the base seed), and the mean tolerances are statistically generous
// — e.g. for normal(3,2) over 100k samples the standard error of the mean is
// σ/√n = 2/√100000 ≈ 0.0063, so the toBeCloseTo(3, 0) bound (|mean−3| < 0.5) is
// ~79 standard errors wide and never fails on variance. The only load-sensitive
// failure mode is wall-clock: under heavy CPU contention the worker spin-up +
// fan-out round-trip can exceed Vitest's 5000ms per-test default. The pool is
// awaited ready in beforeAll, and the hooks + worker tests carry an explicit,
// generous timeout so a slow-but-correct parallel run is not killed mid-flight.
// No assertion or tolerance is changed.
// ===========================================================================
const POOL_HOOK_TIMEOUT = 120_000;
const WORKER_TEST_TIMEOUT = 60_000;

describe('dist-objects — worker-dispatch sampleN (pool ready, n ≥ threshold)', () => {
  beforeAll(async () => {
    await computePool.initialize();
  }, POOL_HOOK_TIMEOUT);

  afterAll(async () => {
    await computePool.terminate();
  }, POOL_HOOK_TIMEOUT);

  it('computePool is ready after initialize', () => {
    expect(computePool.isReady()).toBe(true);
    expect(DIST_WORKER_THRESHOLD).toBe(100_000);
  });

  it(
    'normalDist.sampleN fans out across workers; mean ≈ mu',
    async () => {
      const d = normalDist(3, 2);
      const samples = await d.sampleN(DIST_WORKER_THRESHOLD, { seed: 101 });
      expect(samples).toBeInstanceOf(Float64Array);
      expect(samples.length).toBe(DIST_WORKER_THRESHOLD);
      expect(arrMean(samples)).toBeCloseTo(3, 0);
    },
    WORKER_TEST_TIMEOUT
  );

  it(
    'gammaDist.sampleN worker path; mean ≈ shape*scale',
    async () => {
      const d = gammaDist(2, 1);
      const samples = await d.sampleN(120_000, { seed: 7 });
      expect(samples.length).toBe(120_000);
      expect(arrMean(samples)).toBeCloseTo(2, 0);
    },
    WORKER_TEST_TIMEOUT
  );

  it(
    'betaDist.sampleN worker path; mean ≈ a/(a+b)',
    async () => {
      const d = betaDist(2, 5);
      const samples = await d.sampleN(120_000, { seed: 9 });
      expect(samples.length).toBe(120_000);
      expect(arrMean(samples)).toBeCloseTo(2 / 7, 1);
    },
    WORKER_TEST_TIMEOUT
  );

  it(
    'tDist.sampleN worker path returns finite-dominated array',
    async () => {
      const d = tDist(5);
      const samples = await d.sampleN(120_000, { seed: 11 });
      expect(samples.length).toBe(120_000);
      // Median of Student-t is 0; most mass is near 0.
      expect(Math.abs(arrMean(samples))).toBeLessThan(0.5);
    },
    WORKER_TEST_TIMEOUT
  );

  it(
    'exponentialDist.sampleN worker path; mean ≈ 1/lambda',
    async () => {
      const d = exponentialDist(2);
      const samples = await d.sampleN(120_000, { seed: 13 });
      expect(samples.length).toBe(120_000);
      expect(arrMean(samples)).toBeCloseTo(0.5, 1);
    },
    WORKER_TEST_TIMEOUT
  );

  it(
    'workerCount override clamps to n (effectiveK path)',
    async () => {
      const d = normalDist(0, 1);
      // workerCount huge but clamped to min(K, n); still valid output.
      const samples = await d.sampleN(DIST_WORKER_THRESHOLD, { seed: 1, workerCount: 3 });
      expect(samples.length).toBe(DIST_WORKER_THRESHOLD);
    },
    WORKER_TEST_TIMEOUT
  );
});

// ===========================================================================
// Synchronous sample() generators for every distribution
// ===========================================================================
describe('dist-objects — sample() generators', () => {
  it('normalDist.sample returns a finite number', () => {
    const x = normalDist(0, 1).sample();
    expect(Number.isFinite(x)).toBe(true);
  });

  it('betaDist.sample is within [0,1]', () => {
    const d = betaDist(2, 5);
    for (let i = 0; i < 50; i++) {
      const x = d.sample();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });

  it('betaDist.sample with alpha<1 (exercises _gammaRandom recursion)', () => {
    const d = betaDist(0.5, 0.5);
    const x = d.sample();
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(1);
  });

  it('binomialDist.sample returns integer in [0, n]', () => {
    const d = binomialDist(10, 0.5);
    for (let i = 0; i < 50; i++) {
      const k = d.sample();
      expect(Number.isInteger(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(10);
    }
  });

  it('chiSquaredDist.sample is non-negative', () => {
    const d = chiSquaredDist(3);
    for (let i = 0; i < 30; i++) expect(d.sample()).toBeGreaterThanOrEqual(0);
  });

  it('exponentialDist.sample is non-negative', () => {
    const d = exponentialDist(2);
    for (let i = 0; i < 30; i++) expect(d.sample()).toBeGreaterThanOrEqual(0);
  });

  it('fDist.sample is positive', () => {
    const d = fDist(5, 10);
    for (let i = 0; i < 30; i++) expect(d.sample()).toBeGreaterThan(0);
  });

  it('gammaDist.sample is non-negative', () => {
    const d = gammaDist(2, 1);
    for (let i = 0; i < 30; i++) expect(d.sample()).toBeGreaterThanOrEqual(0);
  });

  it('logNormalDist.sample is positive', () => {
    const d = logNormalDist(0, 1);
    for (let i = 0; i < 30; i++) expect(d.sample()).toBeGreaterThan(0);
  });

  it('poissonDist.sample is a non-negative integer', () => {
    const d = poissonDist(5);
    for (let i = 0; i < 50; i++) {
      const k = d.sample();
      expect(Number.isInteger(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(0);
    }
  });

  it('tDist.sample returns a finite number', () => {
    expect(Number.isFinite(tDist(10).sample())).toBe(true);
  });

  it('uniformDist.sample is within [a, b]', () => {
    const d = uniformDist(2, 8);
    for (let i = 0; i < 50; i++) {
      const x = d.sample();
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThanOrEqual(8);
    }
  });

  it('weibullDist.sample is non-negative', () => {
    const d = weibullDist(2, 1);
    for (let i = 0; i < 30; i++) expect(d.sample()).toBeGreaterThanOrEqual(0);
  });
});

// ===========================================================================
// JS-loop sampleN path (below threshold OR no worker kernel)
// ===========================================================================
describe('dist-objects — JS-loop sampleN for kernel-less distributions', () => {
  it('binomialDist.sampleN (no kernel) returns integers in range', async () => {
    const d = binomialDist(20, 0.3);
    const s = await d.sampleN(500, { seed: 1 });
    expect(s.length).toBe(500);
    for (let i = 0; i < s.length; i++) {
      expect(Number.isInteger(s[i])).toBe(true);
      expect(s[i]).toBeGreaterThanOrEqual(0);
      expect(s[i]).toBeLessThanOrEqual(20);
    }
    expect(arrMean(s)).toBeCloseTo(6, 0); // n*p = 6
  });

  it('chiSquaredDist.sampleN returns non-negative values', async () => {
    const s = await chiSquaredDist(4).sampleN(500, { seed: 2 });
    expect(s.length).toBe(500);
    for (let i = 0; i < s.length; i++) expect(s[i]).toBeGreaterThanOrEqual(0);
    expect(arrMean(s)).toBeCloseTo(4, 0);
  });

  it('fDist.sampleN returns positive values', async () => {
    const s = await fDist(6, 12).sampleN(500, { seed: 3 });
    expect(s.length).toBe(500);
    for (let i = 0; i < s.length; i++) expect(s[i]).toBeGreaterThan(0);
  });

  it('logNormalDist.sampleN returns positive values', async () => {
    const s = await logNormalDist(0, 0.5).sampleN(500, { seed: 4 });
    expect(s.length).toBe(500);
    for (let i = 0; i < s.length; i++) expect(s[i]).toBeGreaterThan(0);
  });

  it('poissonDist.sampleN returns non-negative integers', async () => {
    const s = await poissonDist(3).sampleN(500, { seed: 5 });
    expect(s.length).toBe(500);
    for (let i = 0; i < s.length; i++) {
      expect(Number.isInteger(s[i])).toBe(true);
      expect(s[i]).toBeGreaterThanOrEqual(0);
    }
    expect(arrMean(s)).toBeCloseTo(3, 0);
  });

  it('uniformDist.sampleN values within [a,b] and reproducible by seed', async () => {
    const d = uniformDist(0, 10);
    const a = await d.sampleN(500, { seed: 6 });
    const b = await d.sampleN(500, { seed: 6 });
    expect(a.length).toBe(500);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toBeGreaterThanOrEqual(0);
      expect(a[i]).toBeLessThanOrEqual(10);
      expect(a[i]).toBe(b[i]); // same seed → identical
    }
  });

  it('weibullDist.sampleN returns non-negative values', async () => {
    const s = await weibullDist(2, 1).sampleN(500, { seed: 8 });
    expect(s.length).toBe(500);
    for (let i = 0; i < s.length; i++) expect(s[i]).toBeGreaterThanOrEqual(0);
  });

  it('sampleN without an explicit seed still produces a valid array', async () => {
    // Exercises the random-seed branch of _sampleNDispatch (opts undefined).
    const s = await uniformDist(0, 1).sampleN(100);
    expect(s.length).toBe(100);
    for (let i = 0; i < s.length; i++) {
      expect(s[i]).toBeGreaterThanOrEqual(0);
      expect(s[i]).toBeLessThanOrEqual(1);
    }
  });
});

// ===========================================================================
// pdf / cdf / quantile edge branches + helper branches
// ===========================================================================
describe('dist-objects — pdf/cdf/quantile edge branches', () => {
  it('betaDist pdf Infinity at boundaries when shape params < 1', () => {
    const d = betaDist(0.5, 0.5); // alpha<1 and beta<1
    expect(d.pdf(0)).toBe(Infinity);
    expect(d.pdf(1)).toBe(Infinity);
    // interior is finite
    expect(Number.isFinite(d.pdf(0.5))).toBe(true);
  });

  it('betaDist cdf hits the _betainc symmetry branch for large x', () => {
    const d = betaDist(2, 5);
    // x near 1 triggers x > (a+1)/(a+b+2) symmetry path
    expect(d.cdf(0.95)).toBeGreaterThan(0.99);
    expect(d.cdf(0.95)).toBeLessThanOrEqual(1);
  });

  it('binomialDist pdf p=0 and p=1 special cases', () => {
    const d0 = binomialDist(5, 0);
    expect(d0.pdf(0)).toBe(1);
    expect(d0.pdf(2)).toBe(0);
    const d1 = binomialDist(5, 1);
    expect(d1.pdf(5)).toBe(1);
    expect(d1.pdf(3)).toBe(0);
  });

  it('binomialDist pdf returns 0 for k out of range / negative', () => {
    const d = binomialDist(5, 0.5);
    expect(d.pdf(-1)).toBe(0);
    expect(d.pdf(6)).toBe(0);
  });

  it('binomialDist cdf boundaries and interior; quantile boundaries', () => {
    const d = binomialDist(10, 0.5);
    expect(d.cdf(-1)).toBe(0);
    expect(d.cdf(10)).toBe(1);
    expect(d.cdf(5)).toBeGreaterThan(0);
    expect(d.cdf(5)).toBeLessThan(1);
    expect(d.quantile(0)).toBe(0);
    expect(d.quantile(1)).toBe(10);
    // large-n binomial exercises _logFactorial Stirling branch (n > 20)
    const big = binomialDist(30, 0.5);
    expect(big.pdf(15)).toBeGreaterThan(0);
    expect(Number.isInteger(big.quantile(0.5))).toBe(true);
  });

  it('chiSquaredDist pdf at x=0 across k=1, k=2, k>2', () => {
    expect(chiSquaredDist(1).pdf(0)).toBe(Infinity); // halfK < 1
    expect(chiSquaredDist(2).pdf(0)).toBe(0.5); // halfK === 1
    expect(chiSquaredDist(4).pdf(0)).toBe(0); // halfK > 1
  });

  it('chiSquaredDist quantile boundaries + inversion', () => {
    const d = chiSquaredDist(3);
    expect(d.quantile(0)).toBe(0);
    expect(d.quantile(1)).toBe(Infinity);
    const x = d.quantile(0.5);
    expect(d.cdf(x)).toBeCloseTo(0.5, 3);
  });

  it('exponentialDist quantile boundaries', () => {
    const d = exponentialDist(1);
    expect(d.quantile(0)).toBe(0);
    expect(d.quantile(1)).toBe(Infinity);
  });

  it('fDist pdf at x=0 across d1<2, d1==2, d1>2', () => {
    expect(fDist(1, 10).pdf(0)).toBe(Infinity); // d1 < 2
    expect(fDist(2, 10).pdf(0)).toBe(1); // d1 === 2
    expect(fDist(5, 10).pdf(0)).toBe(0); // d1 > 2
  });

  it('fDist quantile boundaries + bisection inversion; variance NaN cases', () => {
    const d = fDist(5, 10);
    expect(d.quantile(0)).toBe(0);
    expect(d.quantile(1)).toBe(Infinity);
    const x = d.quantile(0.5);
    expect(d.cdf(x)).toBeCloseTo(0.5, 2);
    expect(fDist(5, 2).mean).toBeNaN(); // d2 <= 2
    expect(fDist(5, 4).variance).toBeNaN(); // d2 <= 4
  });

  it('gammaDist pdf at x=0 across shape<1, shape==1, shape>1', () => {
    expect(gammaDist(0.5, 1).pdf(0)).toBe(Infinity); // shape < 1
    expect(gammaDist(1, 2).pdf(0)).toBe(2); // shape === 1 → returns rate
    expect(gammaDist(2, 1).pdf(0)).toBe(0); // shape > 1
  });

  it('gammaDist quantile boundaries + inversion (bisection grow-hi)', () => {
    const d = gammaDist(2, 1);
    expect(d.quantile(0)).toBe(0);
    expect(d.quantile(1)).toBe(Infinity);
    const x = d.quantile(0.99); // large p forces the hi-doubling loop
    expect(d.cdf(x)).toBeCloseTo(0.99, 2);
  });

  it('gammaDist with shape<0.5 exercises _lgamma reflection branch', () => {
    const d = gammaDist(0.25, 1);
    // pdf at an interior point must be finite & positive (uses _lgamma(0.25))
    expect(d.pdf(0.5)).toBeGreaterThan(0);
    expect(Number.isFinite(d.cdf(1))).toBe(true);
  });

  it('logNormalDist quantile boundaries', () => {
    const d = logNormalDist(0, 1);
    expect(d.quantile(0)).toBe(0);
    expect(d.quantile(1)).toBe(Infinity);
  });

  it('poissonDist cdf negative + quantile boundaries/inversion', () => {
    const d = poissonDist(5);
    expect(d.cdf(-1)).toBe(0);
    expect(d.quantile(0)).toBe(0);
    expect(d.quantile(1)).toBe(Infinity);
    expect(Number.isInteger(d.quantile(0.5))).toBe(true);
    // lambda > 20 path keeps _logFactorial Stirling exercised via pdf
    expect(poissonDist(25).pdf(25)).toBeGreaterThan(0);
  });

  it('poissonDist pdf returns 0 for negative / non-integer k', () => {
    const d = poissonDist(5);
    expect(d.pdf(-1)).toBe(0);
    expect(d.pdf(2.5)).toBe(0);
  });

  it('tDist quantile boundaries and symmetry', () => {
    const d = tDist(5);
    expect(d.quantile(0)).toBe(-Infinity);
    expect(d.quantile(1)).toBe(Infinity);
    expect(d.quantile(0.5)).toBe(0);
    const q = d.quantile(0.9);
    expect(d.cdf(q)).toBeCloseTo(0.9, 2);
    // cdf for negative x exercises the 0.5*ib branch
    expect(d.cdf(-1)).toBeLessThan(0.5);
    // variance branches
    expect(tDist(1).mean).toBeNaN(); // nu <= 1
    expect(tDist(1.5).variance).toBe(Infinity); // 1 < nu <= 2
    expect(tDist(0.5).variance).toBeNaN(); // nu <= 1
  });

  it('uniformDist quantile boundaries', () => {
    const d = uniformDist(2, 8);
    expect(d.quantile(0)).toBe(2);
    expect(d.quantile(1)).toBe(8);
    expect(d.quantile(0.5)).toBeCloseTo(5, 10);
  });

  it('weibullDist pdf at x=0 across k==1, k<1, k>1', () => {
    expect(weibullDist(1, 2).pdf(0)).toBe(0.5); // k === 1 → 1/lambda
    expect(weibullDist(0.5, 1).pdf(0)).toBe(Infinity); // k < 1
    expect(weibullDist(2, 1).pdf(0)).toBe(0); // k > 1
  });

  it('weibullDist quantile boundaries', () => {
    const d = weibullDist(2, 1);
    expect(d.quantile(0)).toBe(0);
    expect(d.quantile(1)).toBe(Infinity);
  });

  it('weibullDist / logNormalDist pdf interior (x > 0) values', () => {
    // Closed-form Weibull(k=1) pdf is exponential: f(x) = (1/λ) e^{-x/λ}.
    const w = weibullDist(1, 2);
    expect(w.pdf(2)).toBeCloseTo(0.5 * Math.exp(-1), 10);
    // LogNormal(0,1) pdf at x=1 is 1/√(2π).
    const ln = logNormalDist(0, 1);
    expect(ln.pdf(1)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 10);
  });

  it('betaDist.sampleN JS path with alpha<1 exercises _gammaRandomRng recursion', async () => {
    const s = await betaDist(0.5, 0.5).sampleN(300, { seed: 21 });
    expect(s.length).toBe(300);
    for (let i = 0; i < s.length; i++) {
      expect(s[i]).toBeGreaterThanOrEqual(0);
      expect(s[i]).toBeLessThanOrEqual(1);
    }
  });

  it('binomialDist throws for non-integer or negative n', () => {
    expect(() => binomialDist(2.5, 0.5)).toThrow(/non-negative integer/);
    expect(() => binomialDist(-1, 0.5)).toThrow(/non-negative integer/);
  });
});
