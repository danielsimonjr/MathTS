/**
 * Tests for typed/probability.ts — Slice 4.6
 *
 * Covers:
 *  - bernoulli: Bernoulli numbers (NOT the PMF)
 *  - combinations: C(n,k) binomial coefficients
 *  - combinationsWithRep: multiset coefficients C(n+k-1, k)
 *  - multinomial: multinomial coefficients
 *  - permutations: P(n) = n!, P(n, k) = n!/(n-k)!
 *  - random: uniform float in [min, max)
 *  - randomInt: uniform integer in [min, max)
 *  - pickRandom: uniform/weighted sampling from an array
 *
 * ≥ 20 tests total.
 * Seeded-RNG reproducibility verified (same seed → same output).
 * Distribution sanity (mean/variance over 10K samples within tolerance).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  bernoulli,
  combinations,
  combinationsWithRep,
  multinomial,
  permutations,
  random,
  randomInt,
  pickRandom,
  seedProbabilityRng,
  typedProbability,
} from '../src/typed/probability.js';

// =============================================================================
// bernoulli
// =============================================================================

describe('bernoulli', () => {
  it('B_0 = 1', () => {
    expect(bernoulli(0)).toBe(1);
  });

  it('B_1 = -0.5', () => {
    expect(bernoulli(1)).toBe(-0.5);
  });

  it('B_2 = 1/6', () => {
    expect(bernoulli(2)).toBeCloseTo(1 / 6, 12);
  });

  it('B_4 = -1/30', () => {
    expect(bernoulli(4)).toBeCloseTo(-1 / 30, 12);
  });

  it('B_6 = 1/42', () => {
    expect(bernoulli(6)).toBeCloseTo(1 / 42, 12);
  });

  it('all odd B_n for n > 1 are zero', () => {
    expect(bernoulli(3)).toBe(0);
    expect(bernoulli(5)).toBe(0);
    expect(bernoulli(7)).toBe(0);
    expect(bernoulli(9)).toBe(0);
  });

  it('throws RangeError for negative index', () => {
    expect(() => bernoulli(-1)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer index', () => {
    expect(() => bernoulli(1.5)).toThrow(RangeError);
  });
});

// =============================================================================
// combinations
// =============================================================================

describe('combinations', () => {
  it('C(5, 2) = 10', () => {
    expect(combinations(5, 2)).toBe(10);
  });

  it('C(7, 5) = 21', () => {
    expect(combinations(7, 5)).toBe(21);
  });

  it('C(n, 0) = 1 for any n', () => {
    expect(combinations(10, 0)).toBe(1);
    expect(combinations(0, 0)).toBe(1);
  });

  it('C(n, n) = 1', () => {
    expect(combinations(5, 5)).toBe(1);
  });

  it('C(10, 3) = 120', () => {
    expect(combinations(10, 3)).toBe(120);
  });

  it('throws TypeError when k > n', () => {
    expect(() => combinations(3, 5)).toThrow(TypeError);
  });

  it('throws TypeError for negative n', () => {
    expect(() => combinations(-1, 0)).toThrow(TypeError);
  });

  it('throws TypeError for non-integer k', () => {
    expect(() => combinations(5, 2.5)).toThrow(TypeError);
  });
});

// =============================================================================
// combinationsWithRep
// =============================================================================

describe('combinationsWithRep', () => {
  it('C(7+5-1, 5) = combinationsWithRep(7, 5) = 462', () => {
    expect(combinationsWithRep(7, 5)).toBe(462);
  });

  it('combinationsWithRep(5, 2) = C(6, 2) = 15', () => {
    expect(combinationsWithRep(5, 2)).toBe(15);
  });

  it('combinationsWithRep(n, 0) = 1', () => {
    expect(combinationsWithRep(3, 0)).toBe(1);
  });

  it('throws TypeError for n < 1', () => {
    expect(() => combinationsWithRep(0, 2)).toThrow(TypeError);
  });

  it('throws TypeError for negative k', () => {
    expect(() => combinationsWithRep(5, -1)).toThrow(TypeError);
  });
});

// =============================================================================
// multinomial
// =============================================================================

describe('multinomial', () => {
  it('multinomial([1, 2, 1]) = 12', () => {
    // 4! / (1! * 2! * 1!) = 24 / 2 = 12
    expect(multinomial([1, 2, 1])).toBe(12);
  });

  it('multinomial([1, 1]) = 2', () => {
    expect(multinomial([1, 1])).toBe(2);
  });

  it('multinomial([3]) = 1', () => {
    expect(multinomial([3])).toBe(1);
  });

  it('multinomial([2, 2]) = 6', () => {
    // 4! / (2! * 2!) = 24 / 4 = 6
    expect(multinomial([2, 2])).toBe(6);
  });

  it('multinomial([2, 3, 1]) = 60', () => {
    // 6! / (2! * 3! * 1!) = 720 / 12 = 60
    expect(multinomial([2, 3, 1])).toBe(60);
  });

  it('throws TypeError for zero element', () => {
    expect(() => multinomial([0, 1])).toThrow(TypeError);
  });

  it('throws TypeError for non-integer element', () => {
    expect(() => multinomial([1.5, 1])).toThrow(TypeError);
  });
});

// =============================================================================
// permutations
// =============================================================================

describe('permutations', () => {
  it('permutations(5) = 5! = 120', () => {
    expect(permutations(5)).toBe(120);
  });

  it('permutations(0) = 1', () => {
    expect(permutations(0)).toBe(1);
  });

  it('permutations(5, 3) = 60', () => {
    expect(permutations(5, 3)).toBe(60);
  });

  it('permutations(n, 0) = 1', () => {
    expect(permutations(4, 0)).toBe(1);
  });

  it('permutations(n, n) = n!', () => {
    expect(permutations(4, 4)).toBe(24);
  });

  it('throws TypeError when k > n', () => {
    expect(() => permutations(3, 5)).toThrow(TypeError);
  });
});

// =============================================================================
// random — seeded reproducibility + distribution sanity
// =============================================================================

describe('random', () => {
  beforeEach(() => {
    seedProbabilityRng('test-random-seed');
  });

  it('returns a value in [0, 1) by default', () => {
    const v = random();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('same seed → same sequence (reproducibility)', () => {
    seedProbabilityRng('fixed-seed');
    const a = random();
    seedProbabilityRng('fixed-seed');
    const b = random();
    expect(a).toBe(b);
  });

  it('random(max) returns value in [0, max)', () => {
    const v = random(100);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(100);
  });

  it('random(min, max) returns value in [min, max)', () => {
    const v = random(30, 40);
    expect(v).toBeGreaterThanOrEqual(30);
    expect(v).toBeLessThan(40);
  });

  it('throws RangeError when max < min', () => {
    expect(() => random(10, 5)).toThrow(RangeError);
  });

  it('distribution sanity: mean of 10K samples ≈ 0.5 within 0.02', () => {
    seedProbabilityRng('sanity-mean');
    let sum = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) sum += random();
    const mean = sum / N;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.02);
  });

  it('distribution sanity: variance of 10K samples ≈ 1/12 within 0.005', () => {
    seedProbabilityRng('sanity-var');
    const N = 10_000;
    const samples: number[] = [];
    for (let i = 0; i < N; i++) samples.push(random());
    const mean = samples.reduce((a, b) => a + b, 0) / N;
    const variance = samples.reduce((a, x) => a + (x - mean) ** 2, 0) / N;
    expect(Math.abs(variance - 1 / 12)).toBeLessThan(0.005);
  });
});

// =============================================================================
// randomInt — seeded reproducibility + distribution sanity
// =============================================================================

describe('randomInt', () => {
  beforeEach(() => {
    seedProbabilityRng('test-randomint-seed');
  });

  it('randomInt() returns 0 or 1', () => {
    for (let i = 0; i < 20; i++) {
      const v = randomInt();
      expect([0, 1]).toContain(v);
    }
  });

  it('same seed → same sequence (reproducibility)', () => {
    seedProbabilityRng('fixed-int-seed');
    const a = randomInt(100);
    seedProbabilityRng('fixed-int-seed');
    const b = randomInt(100);
    expect(a).toBe(b);
  });

  it('randomInt(max) returns integer in [0, max)', () => {
    for (let i = 0; i < 50; i++) {
      const v = randomInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('randomInt(min, max) returns integer in [min, max)', () => {
    for (let i = 0; i < 50; i++) {
      const v = randomInt(30, 40);
      expect(v).toBeGreaterThanOrEqual(30);
      expect(v).toBeLessThan(40);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('throws RangeError when max <= min', () => {
    expect(() => randomInt(5, 5)).toThrow(RangeError);
    expect(() => randomInt(6, 5)).toThrow(RangeError);
  });

  it('throws RangeError for non-positive max', () => {
    expect(() => randomInt(0)).toThrow(RangeError);
  });

  it('distribution sanity: mean of 10K samples from [0,10) ≈ 4.5 within 0.2', () => {
    seedProbabilityRng('int-sanity-mean');
    let sum = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) sum += randomInt(10);
    const mean = sum / N;
    expect(Math.abs(mean - 4.5)).toBeLessThan(0.2);
  });
});

// =============================================================================
// pickRandom — seeded reproducibility + weighted sampling
// =============================================================================

describe('pickRandom', () => {
  beforeEach(() => {
    seedProbabilityRng('test-pickrandom-seed');
  });

  it('picks a value from the array', () => {
    const arr = [10, 20, 30, 40];
    const v = pickRandom(arr);
    expect(arr).toContain(v);
  });

  it('picks n values from the array', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = pickRandom(arr, 3) as number[];
    expect(result).toHaveLength(3);
    for (const v of result) expect(arr).toContain(v);
  });

  it('same seed → same single pick (reproducibility)', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    seedProbabilityRng('pick-seed');
    const a = pickRandom(arr);
    seedProbabilityRng('pick-seed');
    const b = pickRandom(arr);
    expect(a).toBe(b);
  });

  it('same seed → same multi-pick sequence (reproducibility)', () => {
    const arr = ['a', 'b', 'c', 'd'];
    seedProbabilityRng('pick-multi');
    const a = pickRandom(arr, 3) as string[];
    seedProbabilityRng('pick-multi');
    const b = pickRandom(arr, 3) as string[];
    expect(a).toEqual(b);
  });

  it('weighted sampling: heavily-weighted element is picked most often', () => {
    seedProbabilityRng('pick-weighted');
    const arr = ['a', 'b', 'c'];
    const weights = [1, 100, 1]; // 'b' should dominate
    const picks = pickRandom(arr, 500, weights) as string[];
    const bCount = picks.filter((x) => x === 'b').length;
    // With weight 100/102, expect roughly 490/500 to be 'b'. Loosen to > 400.
    expect(bCount).toBeGreaterThan(400);
  });

  it('weighted sampling: respects different orderings (Array, Array, number)', () => {
    seedProbabilityRng('pick-weighted-order');
    const arr = [1, 2, 3];
    const weights = [10, 1, 1];
    const result = pickRandom(arr, weights, 100) as number[];
    expect(result).toHaveLength(100);
    const ones = result.filter((x) => x === 1).length;
    expect(ones).toBeGreaterThan(50); // 10/12 ≈ 83%, so > 50 in 100 is very safe
  });

  it('throws RangeError for empty array', () => {
    expect(() => pickRandom([])).toThrow(RangeError);
  });

  it('throws RangeError when weights length mismatches', () => {
    expect(() => pickRandom([1, 2, 3], 1, [0.5, 0.5])).toThrow(RangeError);
  });
});

// =============================================================================
// typedProbability barrel
// =============================================================================

describe('typedProbability barrel', () => {
  it('exports all 8 promoted ops', () => {
    expect(typeof typedProbability.bernoulli).toBe('function');
    expect(typeof typedProbability.combinations).toBe('function');
    expect(typeof typedProbability.combinationsWithRep).toBe('function');
    expect(typeof typedProbability.multinomial).toBe('function');
    expect(typeof typedProbability.permutations).toBe('function');
    expect(typeof typedProbability.random).toBe('function');
    expect(typeof typedProbability.randomInt).toBe('function');
    expect(typeof typedProbability.pickRandom).toBe('function');
  });
});
