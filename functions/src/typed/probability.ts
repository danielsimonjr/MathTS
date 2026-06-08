/**
 * Typed Probability & Combinatorics Functions
 *
 * Promotes genuinely-missing exports from the synced `probability/` layer that
 * are not already surfaced by `typed/distributions.ts` (PDF/PMF/CDF/entropy) or
 * `typed/special.ts` (erf, beta, bessel, …).
 *
 * After dedup audit (2026-05-24):
 *
 * | Synced name        | Promote? | Existing surface (if any)                      | Rationale                                        |
 * | ------------------ | -------- | ---------------------------------------------- | ------------------------------------------------ |
 * | bernoulli          | YES      | —                                              | genuinely missing (bernoulliPMF ≠ Bernoulli number) |
 * | combinations       | YES      | —                                              | genuinely missing                                |
 * | combinationsWithRep| YES      | —                                              | genuinely missing                                |
 * | factorial          | SKIP     | factories/index.ts (tier 7) exports `factorial`| already in active factory surface                |
 * | gamma              | SKIP     | factories/index.ts (tier 6) exports `gamma`    | needs Complex/BigNumber factory deps; in scope   |
 * | kldivergence       | SKIP     | factories/index.ts (tier 13)                   | needs matrix/sum/divide factory wiring           |
 * | lgamma             | SKIP     | factories/index.ts (tier 1)                    | needs WASM bridge + Complex; already wired       |
 * | multinomial        | YES      | —                                              | genuinely missing; clean number[] → number impl  |
 * | permutations       | YES      | —                                              | genuinely missing                                |
 * | pickRandom         | YES      | —                                              | genuinely missing                                |
 * | random             | YES      | —                                              | genuinely missing (scalar seeded-RNG)            |
 * | randomInt          | YES      | —                                              | genuinely missing                                |
 *
 * 8 of 12 promoted; 4 skipped (already in the active factory surface under the
 * same name with richer type coverage than can be achieved in a clean typed/
 * reimplementation).
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import seedrandom from 'seedrandom';

// =============================================================================
// Seeded-RNG helper (shared across random / randomInt / pickRandom)
//
// Each exported function that needs randomness is constructed with its OWN rng
// instance. The rng is re-seeded by calling `<fn>.seed(s)`. The default seed is
// null → uses a time-based singleton (consistent with the mathjs default).
// =============================================================================

type RngFn = () => number;

/**
 * Create a seedrandom-based PRNG.
 * seed === null → time-seeded singleton (not reproducible across sessions).
 * seed is string | number → reproducible.
 */
function makeRng(seed: string | number | null): RngFn {
  return seed === null
    ? (seedrandom as (s?: unknown) => RngFn)()
    : (seedrandom as (s: unknown) => RngFn)(String(seed));
}

// =============================================================================
// Bernoulli numbers (number-theoretic, NOT the Bernoulli PMF)
//
// Algorithm: cotangent-coefficient recursion from
// https://math.stackexchange.com/a/2844337
// Returns B_n (the n-th Bernoulli number) as a JS number.
// NOTE: B_1 = -1/2 per the convention used in most CAS systems.
// =============================================================================

/** Cache entry: [cotangent coefficient a_n, prefactor, B_{2n}] */
type BernoulliEntry = [number, number, number];

const _bernoulliCache: (BernoulliEntry | undefined)[] = [undefined];

/**
 * Return the n-th Bernoulli number for non-negative integer n.
 *
 * B_0 = 1, B_1 = -1/2, B_{2k+1} = 0 for k ≥ 1.
 * Uses the cotangent-coefficient recursion (O(n²) time, O(n) space).
 *
 * @param n - Non-negative integer index
 * @returns B_n as a JS number
 */
function bernoulliNumber(n: number): number {
  if (n < 0 || !Number.isInteger(n)) {
    throw new RangeError('Bernoulli index must be a non-negative integer');
  }
  if (n === 0) return 1;
  if (n === 1) return -0.5;
  if (n % 2 === 1) return 0;

  // Seed cache with B_2 = 1/6
  if (_bernoulliCache.length === 1) {
    _bernoulliCache.push([-1 / 3, -1 / 2, 1 / 6]);
  }

  const half = n / 2;
  while (_bernoulliCache.length <= half) {
    const i = _bernoulliCache.length;
    const lim = Math.floor((i + 1) / 2);
    let a = 0;
    for (let m = 1; m < lim; m++) {
      const em = _bernoulliCache[m] as BernoulliEntry;
      const eim = _bernoulliCache[i - m] as BernoulliEntry;
      a += em[0] * eim[0];
    }
    a *= 2;
    if (i % 2 === 0) {
      const elim = _bernoulliCache[lim] as BernoulliEntry;
      a += elim[0] * elim[0];
    }
    a /= -(2 * i + 1);
    const prev = _bernoulliCache[i - 1] as BernoulliEntry;
    const prefactor = (prev[1] * (-i * (2 * i - 1))) / 2;
    _bernoulliCache.push([a, prefactor, prefactor * a]);
  }

  return (_bernoulliCache[half] as BernoulliEntry)[2];
}

// =============================================================================
// Combinatorics helpers
// =============================================================================

/**
 * Exact integer factorial for n ≤ 170.
 * Returns Infinity for n > 170.
 */
function factorialExact(n: number): number {
  if (n < 0 || !Number.isInteger(n)) {
    throw new RangeError('Factorial argument must be a non-negative integer');
  }
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/**
 * Binomial coefficient C(n, k) for non-negative integers n, k with k ≤ n.
 * Uses the multiplicative formula to avoid overflow for moderate n.
 */
function combinationsExact(n: number, k: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError('Positive integer value expected in function combinations');
  }
  if (!Number.isInteger(k) || k < 0) {
    throw new TypeError('Positive integer value expected in function combinations');
  }
  if (k > n) {
    throw new TypeError('k must be less than or equal to n in function combinations');
  }
  if (k === 0 || k === n) return 1;
  // Use the smaller of k, n-k to minimise multiplications
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < kk; i++) {
    r = (r * (n - i)) / (i + 1);
  }
  return Math.round(r);
}

// =============================================================================
// Public exports
// =============================================================================

/**
 * Return the n-th Bernoulli number.
 *
 * B_0=1, B_1=-1/2, B_{odd>1}=0.
 * For even n, uses the cotangent-coefficient recursion.
 *
 * @example
 * bernoulli(0)  // 1
 * bernoulli(1)  // -0.5
 * bernoulli(2)  // 1/6 ≈ 0.16666…
 * bernoulli(4)  // -1/30
 * bernoulli(7)  // 0 (all odd B_n for n > 1 are zero)
 */
export const bernoulli = mathTyped('bernoulli', {
  number: (n: number): number => bernoulliNumber(n),
});

/**
 * Compute the binomial coefficient C(n, k) — the number of ways of choosing
 * k unordered elements from n elements without replacement.
 *
 * @example
 * combinations(5, 2)  // 10
 * combinations(7, 5)  // 21
 * combinations(10, 0) // 1
 */
export const combinations = mathTyped('combinations', {
  'number, number': (n: number, k: number): number => combinationsExact(n, k),
});

/**
 * Compute the number of ways of choosing k unordered elements from n elements
 * WITH replacement: C(n + k - 1, k).
 *
 * @example
 * combinationsWithRep(7, 5)  // 462
 * combinationsWithRep(5, 2)  // 15
 */
export const combinationsWithRep = mathTyped('combinationsWithRep', {
  'number, number': (n: number, k: number): number => {
    if (!Number.isInteger(n) || n < 1) {
      throw new TypeError(
        'Positive integer value (≥ 1) expected for n in function combinationsWithRep'
      );
    }
    if (!Number.isInteger(k) || k < 0) {
      throw new TypeError('Non-negative integer expected for k in function combinationsWithRep');
    }
    return combinationsExact(n + k - 1, k);
  },
});

/**
 * Compute the multinomial coefficient n! / (a1! * a2! * … * am!) where
 * n = a1 + a2 + … + am.
 *
 * @param a - Array of positive integers
 * @returns Multinomial coefficient as a number
 *
 * @example
 * multinomial([2, 1, 1])  // 12  (= 4! / (2! * 1! * 1!))
 * multinomial([1, 1])     // 2
 * multinomial([3])        // 1
 */
export const multinomial = mathTyped('multinomial', {
  Array: (a: number[]): number => {
    let sum = 0;
    let denomLog = 0;
    for (const ai of a) {
      if (!Number.isInteger(ai) || ai < 1) {
        throw new TypeError('Positive integer values expected in function multinomial');
      }
      sum += ai;
      // accumulate log(ai!) to avoid intermediate overflow
      for (let j = 2; j <= ai; j++) denomLog += Math.log(j);
    }
    let numLog = 0;
    for (let j = 2; j <= sum; j++) numLog += Math.log(j);
    return Math.round(Math.exp(numLog - denomLog));
  },
});

/**
 * Compute the number of ordered subsets of k elements from n elements:
 * P(n, k) = n! / (n-k)!
 *
 * When called with a single argument, returns n! (all permutations of n items).
 *
 * @example
 * permutations(5)     // 120  (= 5!)
 * permutations(5, 3)  // 60   (= 5*4*3)
 */
export const permutations = mathTyped('permutations', {
  number: (n: number): number => {
    if (!Number.isInteger(n) || n < 0) {
      throw new TypeError('Non-negative integer expected in function permutations');
    }
    return factorialExact(n);
  },
  'number, number': (n: number, k: number): number => {
    if (!Number.isInteger(n) || n < 0) {
      throw new TypeError('Non-negative integer expected in function permutations');
    }
    if (!Number.isInteger(k) || k < 0) {
      throw new TypeError('Non-negative integer expected in function permutations');
    }
    if (k > n) {
      throw new TypeError('k must be less than or equal to n in function permutations');
    }
    // product (n-k+1) * (n-k+2) * … * n
    let r = 1;
    for (let i = n - k + 1; i <= n; i++) r *= i;
    return r;
  },
});

// =============================================================================
// Seeded random number generation
//
// Each RNG function carries a `.seed(s)` method so tests can reset the sequence.
// This keeps the typed/ layer stateless at the module level while allowing
// reproducible streams.
// =============================================================================

/** Internal RNG state for random / randomInt / pickRandom (shared). */
let _rng: RngFn = makeRng(null);

/**
 * Reset the internal RNG used by `random`, `randomInt`, and `pickRandom`.
 *
 * Pass `null` to re-initialize with a time-based seed (non-reproducible).
 * Pass a string or number for a reproducible sequence.
 *
 * @example
 * seedProbabilityRng('my-seed-42');
 * random();      // reproducible
 * randomInt(10); // same sequence
 */
export function seedProbabilityRng(seed: string | number | null): void {
  _rng = makeRng(seed);
}

/**
 * Return a uniform random number in [min, max).
 *
 * Overloads:
 *  - `random()` → [0, 1)
 *  - `random(max)` → [0, max)
 *  - `random(min, max)` → [min, max)
 *
 * Uses the shared seeded PRNG (reset via `seedProbabilityRng`).
 *
 * @example
 * seedProbabilityRng('test');
 * random();       // always the same value after a given seed
 * random(100);    // uniform in [0, 100)
 * random(30, 40); // uniform in [30, 40)
 */
export const random = mathTyped('random', {
  '': (): number => _rng(),
  number: (max: number): number => {
    if (max < 0) throw new RangeError('max must be non-negative');
    return _rng() * max;
  },
  'number, number': (min: number, max: number): number => {
    if (max < min) throw new RangeError('max must be >= min');
    return min + _rng() * (max - min);
  },
});

/**
 * Return a uniform random integer in [min, max).
 *
 * Overloads:
 *  - `randomInt()` → 0 or 1
 *  - `randomInt(max)` → integer in [0, max)
 *  - `randomInt(min, max)` → integer in [min, max)
 *
 * Uses the shared seeded PRNG (reset via `seedProbabilityRng`).
 *
 * @example
 * seedProbabilityRng('test');
 * randomInt(10);     // integer in [0, 10)
 * randomInt(30, 40); // integer in [30, 40)
 */
export const randomInt = mathTyped('randomInt', {
  '': (): number => Math.floor(_rng() * 2),
  number: (max: number): number => {
    if (!Number.isInteger(max) || max < 1) {
      throw new RangeError('max must be a positive integer');
    }
    return Math.floor(_rng() * max);
  },
  'number, number': (min: number, max: number): number => {
    if (!Number.isInteger(min)) throw new TypeError('min must be an integer');
    if (!Number.isInteger(max)) throw new TypeError('max must be an integer');
    if (max <= min) throw new RangeError('max must be greater than min');
    return Math.floor(min + _rng() * (max - min));
  },
});

/**
 * Pick one or more random elements from an array, using uniform or weighted
 * sampling with replacement.
 *
 * Overloads:
 *  - `pickRandom(array)` → single element (uniform)
 *  - `pickRandom(array, n)` → n elements (uniform, with replacement)
 *  - `pickRandom(array, weights)` → single element (weighted)
 *  - `pickRandom(array, n, weights)` → n elements (weighted, with replacement)
 *
 * Uses the shared seeded PRNG (reset via `seedProbabilityRng`).
 *
 * @example
 * pickRandom([1, 2, 3, 4])        // one of the four values
 * pickRandom([1, 2, 3, 4], 2)     // array of two values
 * pickRandom(['a','b','c'], 1, [1, 3, 1]) // 'b' chosen 3× more often
 */
export const pickRandom = mathTyped('pickRandom', {
  Array: (arr: unknown[]): unknown => _pick(arr, 1, undefined)[0],
  'Array, number': (arr: unknown[], n: number): unknown[] => _pick(arr, n, undefined),
  'Array, Array': (arr: unknown[], weights: number[]): unknown => _pick(arr, 1, weights)[0],
  'Array, number, Array': (arr: unknown[], n: number, weights: number[]): unknown[] =>
    _pick(arr, n, weights),
  'Array, Array, number': (arr: unknown[], weights: number[], n: number): unknown[] =>
    _pick(arr, n, weights),
});

/**
 * Internal weighted/unweighted sampling with replacement.
 */
function _pick(arr: unknown[], n: number, weights: number[] | undefined): unknown[] {
  if (arr.length === 0) throw new RangeError('Cannot pick from an empty array');
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError('number of picks must be a positive integer');
  }
  if (weights !== undefined) {
    if (weights.length !== arr.length) {
      throw new RangeError('weights must have the same length as the array');
    }
    let total = 0;
    for (const w of weights) {
      if (typeof w !== 'number' || w < 0) {
        throw new TypeError('weights must be an array of non-negative numbers');
      }
      total += w;
    }
    if (total <= 0) throw new RangeError('sum of weights must be positive');
    const result: unknown[] = [];
    for (let i = 0; i < n; i++) {
      let r = _rng() * total;
      for (let j = 0; j < arr.length; j++) {
        r -= weights[j];
        if (r < 0) {
          result.push(arr[j]);
          break;
        }
      }
      // edge case: floating-point makes r ≥ 0 after all elements — push last
      if (result.length < i + 1) result.push(arr[arr.length - 1]);
    }
    return result;
  }
  const result: unknown[] = [];
  for (let i = 0; i < n; i++) {
    result.push(arr[Math.floor(_rng() * arr.length)]);
  }
  return result;
}

// =============================================================================
// Named Export Collection
// =============================================================================

/**
 * All typed probability & combinatorics functions promoted by Slice 4.6.
 * (Seeded-RNG state is shared; call `seedProbabilityRng` to reset.)
 */
export const typedProbability = {
  bernoulli,
  combinations,
  combinationsWithRep,
  multinomial,
  permutations,
  random,
  randomInt,
  pickRandom,
};
