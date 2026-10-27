/**
 * Sprint 2R PR batch 6 (G35–G39, G44) — behavioral pins before scalar clone merge.
 * Independent oracles; literals guard floor- vs round-Euclid, closed beta domain,
 * gammainc tail, binomial coefficients, restart aggregation, and trial isPrime.
 */
import { describe, it, expect } from 'vitest';
import {
  gcd,
  gammainc,
  betainc,
  betaDist,
  isPrime,
  hypergeometricDist,
  pageRank,
  betweennessCentrality,
  type PageRankRestartResult,
  type BetweennessRestartResult,
} from '../src/index.js';
import { aggregateRestartVectors } from '../src/typed/aggregate-restart.js';
import { euclidSnap } from '../src/typed/euclid.js';
import { kernelSource } from '../src/typed/parallel-map.js';
import {
  _lgamma,
  betaincClosedScalar,
  betaincScalar,
  chooseScalar,
  erfcSelfContained,
  gammaincScalar,
} from '../src/wasm/special/scalars.js';
import { trialPrime } from '../src/utils/isPrime.js';

/** Independent round-before-Euclid oracle (iltGcd semantics). */
function roundEuclidOracle(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const tmp = b;
    b = a % b;
    a = tmp;
  }
  return a;
}

/** Independent floor-before-Euclid oracle (gcd number overload). */
function floorEuclidOracle(a: number, b: number): number {
  a = Math.abs(Math.floor(a));
  b = Math.abs(Math.floor(b));
  while (b !== 0) {
    const tmp = b;
    b = a % b;
    a = tmp;
  }
  return a;
}

/** n! for n small enough that n! is exact in float64 (n ≤ 18). */
function factorialOracle(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Independent binomial C(n, k) = n! / (k! (n−k)!) with the k<0 / k>n zero convention. */
function chooseByFactorial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  return factorialOracle(n) / (factorialOracle(k) * factorialOracle(n - k));
}

/** Population mean/std across restart vectors (mathematical definition). */
function aggregateOracle(vectors: Float64Array[]): { mean: number[]; std: number[] } {
  const n = vectors[0].length;
  const count = vectors.length;
  const mean = new Float64Array(n);
  for (const v of vectors) {
    for (let i = 0; i < n; i++) mean[i] += v[i];
  }
  for (let i = 0; i < n; i++) mean[i] /= count;

  const std = new Float64Array(n);
  for (const v of vectors) {
    for (let i = 0; i < n; i++) {
      const d = v[i] - mean[i];
      std[i] += d * d;
    }
  }
  for (let i = 0; i < n; i++) std[i] = Math.sqrt(std[i] / count);

  return { mean: [...mean], std: [...std] };
}

describe('G35 — gcd floor-Euclid vs round-Euclid (iltGcd)', () => {
  it('gcd(1.9, 1.2) uses floor snapping (both operands become 1)', () => {
    expect(gcd(1.9, 1.2)).toBe(1);
    expect(floorEuclidOracle(1.9, 1.2)).toBe(1);
    expect(euclidSnap(1.9, 1.2, Math.floor)).toBe(1);
    // round(1.9)=2, round(1.2)=1 → gcd 1 as well; snap still differs
    expect(roundEuclidOracle(1.9, 1.2)).toBe(1);
    expect(euclidSnap(1.9, 1.2, Math.round)).toBe(1);
  });

  it('round-Euclid on 3.6, 2.4 differs from floor gcd (2 vs 1)', () => {
    expect(gcd(3.6, 2.4)).toBe(1);
    expect(floorEuclidOracle(3.6, 2.4)).toBe(1);
    expect(euclidSnap(3.6, 2.4, Math.floor)).toBe(1);
    expect(roundEuclidOracle(3.6, 2.4)).toBe(2);
    expect(euclidSnap(3.6, 2.4, Math.round)).toBe(2);
  });
});

describe('G36 — gammaincScalar equivalence (lower P, not 1−P tail shortcut)', () => {
  it('gammainc(0, 0) = 0', () => {
    expect(gammainc(0, 0)).toBe(0);
    expect(gammaincScalar(0, 0)).toBe(0);
  });

  it('gammainc(1, 1) = 1 − 1/e', () => {
    expect(gammainc(1, 1)).toBeCloseTo(1 - 1 / Math.E, 12);
    expect(gammaincScalar(1, 1)).toBeCloseTo(1 - 1 / Math.E, 12);
  });

  it('gammainc(1, x) = 1 − e^{−x} on a small grid', () => {
    for (const x of [0.5, 1, 2, 4]) {
      expect(gammaincScalar(1, x)).toBeCloseTo(1 - Math.exp(-x), 12);
    }
  });

  it('gammainc(5, 80) stays in the upper-tail series branch (≈ 1, not a spurious 0)', () => {
    const p = gammainc(5, 80) as number;
    expect(p).toBeGreaterThan(1 - 1e-10);
    expect(p).toBeLessThanOrEqual(1);
    expect(gammaincScalar(5, 80)).toBe(p);
  });

  it('large a stays on the series branch and matches the public overload', () => {
    expect(gammaincScalar(50, 20)).toBe(gammainc(50, 20) as number);
    expect(gammaincScalar(50, 20)).toBeGreaterThan(0);
    expect(gammaincScalar(50, 20)).toBeLessThan(1);
  });
});

describe('G37 — closed beta domain vs betaincScalar', () => {
  it('betaDist cdf extends: x = −0.1 → 0, x = 1.5 → 1', () => {
    const d = betaDist(2, 5);
    expect(d.cdf(-0.1)).toBe(0);
    expect(d.cdf(1.5)).toBe(1);
  });

  it('betaincClosedScalar matches those closed guards; betaincScalar stays NaN', () => {
    expect(betaincClosedScalar(-0.1, 2, 5)).toBe(0);
    expect(betaincClosedScalar(1.5, 2, 5)).toBe(1);
    expect(betaincClosedScalar(0, 2, 5)).toBe(0);
    expect(betaincClosedScalar(1, 2, 5)).toBe(1);
    expect(betaincScalar(2, 5, -0.1)).toBeNaN();
    expect(betaincScalar(2, 5, 1.5)).toBeNaN();
  });

  it('betainc returns NaN outside [0, 1]', () => {
    expect(betainc(2, 5, -0.1)).toBeNaN();
    expect(betainc(2, 5, 1.5)).toBeNaN();
  });

  it('interior grid: closed helper equals betaincScalar (same CF, open-domain NaN unused)', () => {
    for (const x of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(betaincClosedScalar(x, 2, 5)).toBe(betaincScalar(2, 5, x));
    }
  });
});

describe('G38 — choose / binomial coefficient', () => {
  it('C(10, 3) = 120 via factorial oracle and hypergeometric normalization', () => {
    expect(chooseByFactorial(10, 3)).toBe(120);
    expect(chooseScalar(10, 3)).toBe(120);
    const h = hypergeometricDist(10, 3, 3);
    expect(h.pdf(3)).toBeCloseTo(1 / 120, 12);
  });

  it('C(5, −1) = 0, C(5, 6) = 0, C(5, 5) = 1, C(5, 0) = 1', () => {
    expect(chooseByFactorial(5, -1)).toBe(0);
    expect(chooseScalar(5, -1)).toBe(0);
    expect(chooseScalar(5, 6)).toBe(0);
    expect(chooseByFactorial(5, 5)).toBe(1);
    expect(chooseScalar(5, 5)).toBe(1);
    expect(chooseScalar(5, 0)).toBe(1);
    expect(hypergeometricDist(5, 5, 5).pdf(5)).toBe(1);
  });

  it('C(40, 2) = 780 (large n; factorial 40! is not exact in float64)', () => {
    expect(chooseScalar(40, 2)).toBe(780);
  });
});

describe('G39 — aggregateRestartVectors (mean + population std)', () => {
  const vectors = [new Float64Array([1, 2, 3]), new Float64Array([4, 5, 6])];
  const oracle = aggregateOracle(vectors);

  it('oracle on two fixed vectors', () => {
    expect(oracle.mean).toEqual([2.5, 3.5, 4.5]);
    expect(oracle.std).toEqual([1.5, 1.5, 1.5]);
    const merged = aggregateRestartVectors(vectors, 'all');
    expect([...merged.mean]).toEqual(oracle.mean);
    expect([...merged.std!]).toEqual(oracle.std);
  });

  it("aggregation='mean' returns only mean (no std field)", () => {
    const merged = aggregateRestartVectors(vectors, 'mean');
    expect([...merged.mean]).toEqual(oracle.mean);
    expect(merged.std).toBeUndefined();
    expect(Object.keys(merged)).toEqual(['mean']);
  });

  it('empty vectors[0] throws (same as the pre-merge helpers)', () => {
    expect(() => aggregateRestartVectors([], 'mean')).toThrow();
    expect(() => aggregateRestartVectors([], 'all')).toThrow();
  });

  it('pageRank aggregation=all matches pinned restartStats (path graph, 2 restarts)', async () => {
    const adj = [
      [0, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ];
    const r = (await pageRank(adj, {
      restarts: 2,
      aggregation: 'all',
      restartSeed: 42,
    })) as PageRankRestartResult;
    expect([...r.ranks]).toEqual([0.25675675982141627, 0.48648648035716724, 0.25675675982141627]);
    expect([...r.restartStats!.mean]).toEqual([...r.ranks]);
    expect([...r.restartStats!.std]).toEqual([
      1.0366413238926953e-7, 2.0732826475078348e-7, 1.0366413238926953e-7,
    ]);
  });

  it('betweenness aggregation=all matches pinned centrality restartStats', async () => {
    const adj = [
      [0, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ];
    const r = (await betweennessCentrality(adj, {
      restarts: 2,
      aggregation: 'all',
      restartSeed: 42,
    })) as BetweennessRestartResult;
    expect([...r.restartStats!.mean]).toEqual([0, 0.75, 0]);
    expect([...r.restartStats!.std]).toEqual([0, 0.25, 0]);
  });
});

describe('G44 — isPrime trial division (number and bigint)', () => {
  const NUMBER_TRIAL = { zero: 0, one: 1, two: 2, three: 3, five: 5, six: 6 };
  const BIGINT_TRIAL = { zero: 0n, one: 1n, two: 2n, three: 3n, five: 5n, six: 6n };

  it('number: 1, 2, 4, 9, 97', () => {
    expect(isPrime(1)).toBe(false);
    expect(isPrime(2)).toBe(true);
    expect(isPrime(4)).toBe(false);
    expect(isPrime(9)).toBe(false);
    expect(isPrime(97)).toBe(true);
  });

  it('bigint: 1n, 2n, 4n, 9n, 97n', () => {
    expect(isPrime(1n)).toBe(false);
    expect(isPrime(2n)).toBe(true);
    expect(isPrime(4n)).toBe(false);
    expect(isPrime(9n)).toBe(false);
    expect(isPrime(97n)).toBe(true);
  });

  it('number: 0, negatives, 3, 91, 2147483647 match trialPrime', () => {
    expect(isPrime(0)).toBe(false);
    expect(isPrime(-1)).toBe(false);
    expect(isPrime(-7)).toBe(false);
    expect(isPrime(3)).toBe(true);
    expect(isPrime(91)).toBe(false);
    expect(isPrime(2147483647)).toBe(true);
    expect(trialPrime(0, NUMBER_TRIAL)).toBe(false);
    expect(trialPrime(2147483647, NUMBER_TRIAL)).toBe(true);
  });

  it('bigint: 0n, negatives, 3n, 91n, 2147483647n match trialPrime', () => {
    expect(isPrime(0n)).toBe(false);
    expect(isPrime(-1n)).toBe(false);
    expect(isPrime(-7n)).toBe(false);
    expect(isPrime(3n)).toBe(true);
    expect(isPrime(91n)).toBe(false);
    expect(isPrime(2147483647n)).toBe(true);
    expect(trialPrime(0n, BIGINT_TRIAL)).toBe(false);
    expect(trialPrime(2147483647n, BIGINT_TRIAL)).toBe(true);
  });

  it('mixed 0 and 0n throws (no silent composite-every-odd-bigint)', () => {
    expect(() => trialPrime(9n, NUMBER_TRIAL as never)).toThrow();
  });
});

/** Evaluate a `kernelSource` bundle the same way workers do. */
function evalKernel(src: string): (x: number) => number {
  // eslint-disable-next-line no-new-func -- mirrors worker eval of serialized kernels
  return new Function(`return (${src})`)() as (x: number) => number;
}

describe('worker kernelSource stays self-contained after the deletion', () => {
  it('KS kernel embeds only erfcSelfContained (no gammainc/betainc/choose)', () => {
    const src = kernelSource(
      [erfcSelfContained],
      '(x) => 0.5 * erfcSelfContained(-x / Math.SQRT2)'
    );
    expect(src).toContain('erfcSelfContained');
    expect(src).not.toMatch(/gammainc/);
    expect(src).not.toMatch(/betainc/);
    expect(src).not.toMatch(/chooseScalar/);
    expect(evalKernel(src)(0)).toBeCloseTo(0.5, 12);
  });

  it('gammainc Float64Array kernel still serializes _lgamma + gammaincScalar', () => {
    const src = kernelSource([_lgamma, gammaincScalar], '(x) => gammaincScalar(1, x)');
    expect(evalKernel(src)(1)).toBeCloseTo(1 - 1 / Math.E, 12);
  });
});
