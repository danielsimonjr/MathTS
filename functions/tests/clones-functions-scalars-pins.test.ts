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
import { aggregateRestartVectors } from '../src/typed/graph.js';

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

/** Independent binomial coefficient oracle (multiplicative form). */
function chooseOracle(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < kk; i++) r = (r * (n - i)) / (i + 1);
  return r;
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
  });

  it('round-Euclid on 3.6, 2.4 differs from floor gcd (2 vs 1)', () => {
    expect(gcd(3.6, 2.4)).toBe(1);
    expect(roundEuclidOracle(3.6, 2.4)).toBe(2);
  });
});

describe('G36 — gammaincScalar equivalence (lower P, not 1−P tail shortcut)', () => {
  it('gammainc(0, 0) = 0', () => {
    expect(gammainc(0, 0)).toBe(0);
  });

  it('gammainc(1, 1) = 1 − 1/e', () => {
    expect(gammainc(1, 1)).toBeCloseTo(1 - 1 / Math.E, 12);
  });

  it('gammainc(5, 80) stays in the upper-tail series branch (≈ 1, not a spurious 0)', () => {
    const p = gammainc(5, 80) as number;
    expect(p).toBeGreaterThan(1 - 1e-10);
    expect(p).toBeLessThanOrEqual(1);
  });
});

describe('G37 — closed beta domain vs betaincScalar', () => {
  it('betaDist cdf extends: x = −0.1 → 0, x = 1.5 → 1', () => {
    const d = betaDist(2, 5);
    expect(d.cdf(-0.1)).toBe(0);
    expect(d.cdf(1.5)).toBe(1);
  });

  it('betainc returns NaN outside [0, 1]', () => {
    expect(betainc(2, 5, -0.1)).toBeNaN();
    expect(betainc(2, 5, 1.5)).toBeNaN();
  });
});

describe('G38 — choose / binomial coefficient', () => {
  it('C(10, 3) = 120 via hypergeometric normalization', () => {
    expect(chooseOracle(10, 3)).toBe(120);
    const h = hypergeometricDist(10, 3, 3);
    expect(h.pdf(3)).toBeCloseTo(1 / 120, 12);
  });

  it('C(5, −1) = 0 and C(5, 5) = 1', () => {
    expect(chooseOracle(5, -1)).toBe(0);
    expect(chooseOracle(5, 5)).toBe(1);
    expect(hypergeometricDist(5, 5, 5).pdf(5)).toBe(1);
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
});
