/**
 * Typed Probability & Combinatorics Functions
 *
 * Promotes genuinely-missing exports from the activated `probability/` layer that
 * are not already surfaced by `typed/distributions.ts` (PDF/PMF/CDF/entropy) or
 * `typed/special.ts` (erf, beta, bessel, …).
 *
 * After dedup audit (2026-05-24):
 *
 * | mathjs name        | Promote? | Existing surface (if any)                      | Rationale                                        |
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

import { unaryCollectionCallback } from '@danielsimonjr/mathts-core/internal';
import { mathTyped, BigNumber, isBigNumber } from '@danielsimonjr/mathts-core';
import type { Fraction } from '@danielsimonjr/mathts-core';
import type { IMatrix as Matrix } from '@danielsimonjr/mathts-core';
import { deepMap } from '../utils/collection.js';
import { assertAllocSize, assertLoopOrder } from '../utils/limits.js';
import { product } from '../utils/product.js';
import { binomialBigInt, rangeProductBigInt } from '../probability/bigint-binomial.js';
import { binomialLoop, roundedLoop } from '../probability/rounded-loop.js';
import seedrandom from 'seedrandom';
import { gammaNumber } from '../plain/number/probability.js';
import { denseOfSize } from '../factories/matrix-bridge.js';
import { multinomialExact } from '../probability/multinomial-exact.js';

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

/** Largest even index n with a finite B_n as a double. */
const BERNOULLI_MAX_FINITE_INDEX = 258;

/**
 * Smallest even index that uses the zeta product. The cotangent recursion below loses range
 * from n = 198 (its cached coefficients underflow and the prefactors overflow, so the product
 * is an infinity), and B_n of every index up to 258 is a finite double (#1102).
 */
const BERNOULLI_ZETA_FROM_INDEX = 190;

/** Cache entry: [cotangent coefficient a_n, prefactor, B_{2n}] */
type BernoulliEntry = [number, number, number];

const _bernoulliCache: (BernoulliEntry | undefined)[] = [undefined];

/**
 * B_n for an even n from 190 to 258: `B_n = (-1)^(n/2+1) · 2 · n! ζ(n) / (2π)^n`. The partial
 * products of `k / 2π` stay below the final value, so nothing overflows. ζ(n) = 1 + 2^-n + ...
 * is 1 in double precision from n = 54, so the sum is not needed.
 */
function bernoulliFromZeta(n: number): number {
  let product = 2;
  for (let k = 1; k <= n; k++) product *= k / (2 * Math.PI);
  return (n / 2) % 2 === 1 ? product : -product;
}

/**
 * Return the n-th Bernoulli number for non-negative integer n.
 *
 * B_0 = 1, B_1 = -1/2, B_{2k+1} = 0 for k ≥ 1.
 * Uses the cotangent-coefficient recursion below n = 190 (O(n²) time, O(n) space) and the
 * zeta product `|B_n| = 2 n! ζ(n) / (2π)^n` from n = 190 up to the last finite value n = 258.
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
  // |B_n| is above the largest double from n = 260 (B_258 = 1.3e306 is the last finite
  // value). The sign of B_2m is (-1)^(m+1), which the infinity keeps.
  if (n > BERNOULLI_MAX_FINITE_INDEX) return (n / 2) % 2 === 0 ? -Infinity : Infinity;
  if (n >= BERNOULLI_ZETA_FROM_INDEX) return bernoulliFromZeta(n);

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
 * A bigint or a Fraction as a number. `combinations` and `permutations` read such an argument as a
 * number and give a number, as they did before they had BigNumber signatures. Without the explicit
 * signatures that use this function, the engine would convert the argument to a BigNumber.
 */
function scalarToNumber(value: number | bigint | Fraction): number {
  if (typeof value === 'number') return value;
  return typeof value === 'bigint' ? Number(value) : value.toNumber();
}

/** True when `n` is a non-negative integer BigNumber (false for NaN, Infinity and a fraction). */
function isNonNegativeIntegerBigNumber(n: BigNumber): boolean {
  return n.isInteger() && !n.isNegative();
}

/** The product lo * (lo + 1) * ... * hi, rounded one time to the precision. */
function roundedRangeProduct(lo: bigint, hi: bigint): BigNumber {
  return roundedLoop(
    { steps: hi - lo + 1n, top: hi, divides: false, operations: Number(hi - lo + 1n) },
    () => {
      let result = BigNumber.fromNumber(1);
      for (let i = lo; i <= hi; i++) result = result.times(BigNumber.fromBigInt(i));
      return result;
    },
    () => rangeProductBigInt(lo, hi)
  );
}

/**
 * Binomial coefficient C(n, k) for non-negative integers n, k with k ≤ n.
 * Returns `Infinity` as soon as the running product overflows.
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
    throw new TypeError('k must be less than or equal to n');
  }
  if (k === 0 || k === n) return 1;
  // Use the smaller of k, n-k to minimise multiplications
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < kk; i++) {
    r = (r * (n - i)) / (i + 1);
    // C(n, i) grows at least like 2^i, so an infinity comes within about 1030 steps. The
    // value stays infinite, so the loop does not need to run on.
    if (r === Infinity) return Infinity;
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
 * For even n, uses the cotangent-coefficient recursion. For an even `n` above 258,
 * `|B_n|` is above the largest double, and the result is `-Infinity` when `n / 2` is
 * even and `Infinity` when it is odd.
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

/** Throws the mathjs `TypeError` when an argument is not a non-negative integer BigNumber. */
function assertNonNegativeIntegers(fnName: string, n: BigNumber, k: BigNumber): void {
  if (!isNonNegativeIntegerBigNumber(n) || !isNonNegativeIntegerBigNumber(k)) {
    throw new TypeError(`Positive integer value expected in function ${fnName}`);
  }
}

/**
 * The exact binomial coefficient C(total, chosen), rounded one time to the precision. The loop of
 * the shorter side is bounded first.
 * @throws RangeError when the loop would need more than the supported number of steps
 */
function roundedBinomial(fnName: string, total: bigint, chosen: bigint): BigNumber {
  const steps = chosen < total - chosen ? chosen : total - chosen;
  assertLoopOrder(fnName, 'k', Number(steps));
  return roundedLoop(
    { steps, top: total, divides: true, operations: 2 * Number(steps) },
    () => binomialLoop(total, steps),
    () => binomialBigInt(total, chosen)
  );
}

/**
 * `combinations` of two BigNumbers: the exact binomial coefficient, rounded one time to the precision.
 * @throws TypeError when an argument is not a non-negative integer, or when `k > n`
 * @throws RangeError when the loop would need more than the supported number of steps
 */
function combinationsBigNumber(n: BigNumber, k: BigNumber): BigNumber {
  assertNonNegativeIntegers('combinations', n, k);
  if (k.greaterThan(n)) {
    throw new TypeError('k must be less than n in function combinations');
  }
  return roundedBinomial('combinations', n.toBigInt(), k.toBigInt());
}

/**
 * Compute the binomial coefficient C(n, k) — the number of ways of choosing
 * k unordered elements from n elements without replacement.
 *
 * Two BigNumbers (or a BigNumber and a number) give the exact value as a BigNumber, rounded one
 * time to the precision. An Array or a Matrix of `n` (or of `k`) gives the collection of the results.
 *
 * @example
 * combinations(5, 2)  // 10
 * combinations(7, 5)  // 21
 * combinations(10, 0) // 1
 */
export const combinations = mathTyped('combinations', {
  'number, number': (n: number, k: number): number => combinationsExact(n, k),
  'bigint | Fraction, number | bigint | Fraction': (
    n: bigint | Fraction,
    k: number | bigint | Fraction
  ): number => combinationsExact(scalarToNumber(n), scalarToNumber(k)),
  'number, bigint | Fraction': (n: number, k: bigint | Fraction): number =>
    combinationsExact(n, scalarToNumber(k)),
  'BigNumber, BigNumber': combinationsBigNumber,
  'BigNumber, number': (n: BigNumber, k: number): BigNumber =>
    combinationsBigNumber(n, BigNumber.fromNumber(k)),
  'number, BigNumber': (n: number, k: BigNumber): BigNumber =>
    combinationsBigNumber(BigNumber.fromNumber(n), k),
  // Collections map elementwise over whichever argument is the collection
  // (as `permutations` does); two collections are not zipped.
  'Array | Matrix, number | BigNumber': mathTyped.referToSelf(
    (self) =>
      (n: unknown[] | Matrix, k: number | BigNumber): unknown[] | Matrix =>
        deepMap(n as unknown[], (nVal) =>
          (self as (a: unknown, b: unknown) => unknown)(nVal, k)
        ) as unknown[] | Matrix
  ),
  'number | BigNumber, Array | Matrix': mathTyped.referToSelf(
    (self) =>
      (n: number | BigNumber, k: unknown[] | Matrix): unknown[] | Matrix =>
        deepMap(k as unknown[], (kVal) =>
          (self as (a: unknown, b: unknown) => unknown)(n, kVal)
        ) as unknown[] | Matrix
  ),
});

/** `combinationsWithRep` of two numbers: C(n + k - 1, k) with the mathjs checks and texts. */
function combinationsWithRepOfNumbers(n: number, k: number): number {
  if (!Number.isInteger(n) || n < 0 || !Number.isInteger(k) || k < 0) {
    throw new TypeError('Positive integer value expected in function combinationsWithRep');
  }
  if (n < 1) throw new TypeError('k must be less than or equal to n + k - 1');
  return combinationsExact(n + k - 1, k);
}

/**
 * `combinationsWithRep` of two BigNumbers: the exact multiset coefficient C(n + k - 1, k), rounded
 * one time to the precision. The checks and the texts are the mathjs ones.
 */
function combinationsWithRepBigNumber(n: BigNumber, k: BigNumber): BigNumber {
  assertNonNegativeIntegers('combinationsWithRep', n, k);
  if (n.isZero()) {
    throw new TypeError(
      'k must be less than or equal to n + k - 1 in function combinationsWithRep'
    );
  }
  const chosen = k.toBigInt();
  return roundedBinomial('combinationsWithRep', n.toBigInt() + chosen - 1n, chosen);
}

/**
 * Compute the number of ways of choosing k unordered elements from n elements
 * WITH replacement: C(n + k - 1, k).
 *
 * Two BigNumbers (or a BigNumber and a number) give the exact value as a BigNumber, rounded one
 * time to the precision.
 *
 * @example
 * combinationsWithRep(7, 5)  // 462
 * combinationsWithRep(5, 2)  // 15
 */
export const combinationsWithRep = mathTyped('combinationsWithRep', {
  'number, number': combinationsWithRepOfNumbers,
  // A bigint or a Fraction is read as a number, as in `combinations`.
  'bigint | Fraction, number | bigint | Fraction': (
    n: bigint | Fraction,
    k: number | bigint | Fraction
  ): number => combinationsWithRepOfNumbers(scalarToNumber(n), scalarToNumber(k)),
  'number, bigint | Fraction': (n: number, k: bigint | Fraction): number =>
    combinationsWithRepOfNumbers(n, scalarToNumber(k)),
  'BigNumber, BigNumber': combinationsWithRepBigNumber,
  'BigNumber, number': (n: BigNumber, k: number): BigNumber =>
    combinationsWithRepBigNumber(n, BigNumber.fromNumber(k)),
  'number, BigNumber': (n: number, k: BigNumber): BigNumber =>
    combinationsWithRepBigNumber(BigNumber.fromNumber(n), k),
});

/**
 * Read the entries of a multinomial argument, in order, into `parts`. A nested Array or Matrix is
 * read recursively. A boolean is 0 or 1, as in mathjs. A hole of an Array is read as `undefined`.
 * @throws TypeError for an entry that is not an integer of 1 or more
 */
function collectMultinomialParts(value: unknown, parts: (number | BigNumber)[]): void {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) collectMultinomialParts(value[i], parts);
    return;
  }
  if (value !== null && typeof value === 'object' && (value as { isMatrix?: unknown }).isMatrix) {
    collectMultinomialParts((value as { toArray(): unknown }).toArray(), parts);
    return;
  }
  const entry = typeof value === 'boolean' ? (value ? 1 : 0) : value;
  const valid = isBigNumber(entry)
    ? entry.isInteger() && entry.greaterThanOrEqual(1)
    : typeof entry === 'number' && Number.isInteger(entry) && entry >= 1;
  if (!valid) {
    throw new TypeError('Positive integer value expected in function multinomial');
  }
  parts.push(entry as number | BigNumber);
}

/**
 * The multinomial of positive integers as an exact bigint: a product of binomials
 * C(total + a, a), as `multinomialExact` computes, with no cap on the size of the result.
 * @throws RangeError when the loops would need more than the supported number of steps
 */
function multinomialBigInt(parts: readonly bigint[]): bigint {
  let total = 0n;
  let steps = 0;
  let result = 1n;
  for (const a of parts) {
    steps += Number(a < total ? a : total);
    assertLoopOrder('multinomial', 'the sum of the entries', steps);
    result *= binomialBigInt(total + a, a);
    total += a;
  }
  return result;
}

/**
 * The multinomial of positive integers as a BigNumber rounded one time to the precision: the exact
 * bigint while that stays short, else the same product of binomials at a working precision.
 * @throws RangeError when the loops would need more than the supported number of steps
 */
function roundedMultinomial(parts: readonly bigint[]): BigNumber {
  let total = 0n;
  let steps = 0n;
  for (const a of parts) {
    steps += a < total ? a : total;
    total += a;
  }
  assertLoopOrder('multinomial', 'the sum of the entries', Number(steps));
  return roundedLoop(
    // Each part runs a binomial loop, and one product joins it to the result.
    { steps, top: total, divides: true, operations: 2 * Number(steps) + parts.length },
    () => {
      let sum = 0n;
      let result = BigNumber.fromNumber(1);
      for (const a of parts) {
        result = result.times(binomialLoop(sum + a, a < sum ? a : sum));
        sum += a;
      }
      return result;
    },
    () => multinomialBigInt(parts)
  );
}

/**
 * Compute the multinomial coefficient n! / (a1! * a2! * … * am!) where
 * n = a1 + a2 + … + am.
 *
 * An entry is a number, a boolean or a BigNumber. With a BigNumber entry the result is a BigNumber:
 * the exact value, rounded one time to the precision. With numbers only the result is a number,
 * and it is Infinity when it overflows.
 *
 * @param a - Array (or Matrix) of positive integers
 * @returns Multinomial coefficient as a number or a BigNumber
 *
 * @example
 * multinomial([2, 1, 1])  // 12  (= 4! / (2! * 1! * 1!))
 * multinomial([1, 1])     // 2
 * multinomial([3])        // 1
 */
export const multinomial = mathTyped('multinomial', {
  // A nested array or a matrix counts all of its entries, as in mathjs.
  'Array | Matrix': (input: unknown[] | Matrix): number | BigNumber => {
    const parts: (number | BigNumber)[] = [];
    // Validate every entry before any early return, as mathjs does.
    collectMultinomialParts(input, parts);
    if (!parts.some((p) => isBigNumber(p))) return multinomialExact(parts as number[]);
    return roundedMultinomial(parts.map((p) => (isBigNumber(p) ? p.toBigInt() : BigInt(p))));
  },
});

/**
 * `permutations` of one number: n! of a non-integer n is gamma(n + 1), as in mathjs. An integer n
 * above 170 is Infinity.
 */
function permutationsOfNumber(n: number): number {
  if (n < 0) throw new RangeError('Value must be non-negative');
  if (!Number.isInteger(n)) return gammaNumber(n + 1);
  return n > 170 ? Infinity : product(1, n);
}

/** `permutations` of two numbers: the product (n - k + 1) * … * n. */
function permutationsOfNumbers(n: number, k: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError('Positive integer value expected in function permutations');
  }
  if (!Number.isInteger(k) || k < 0) {
    throw new TypeError('Positive integer value expected in function permutations');
  }
  if (k > n) {
    throw new TypeError('second argument k must be less than or equal to first argument n');
  }
  // k above 170 gives at least 171!, which is above Number.MAX_VALUE (and n - j would reach 0
  // for k = n).
  if (k > 170) return Infinity;
  // The product, split at the midpoint as mathjs does.
  if (n <= Number.MAX_SAFE_INTEGER) return product(n - k + 1, n);
  // Above 2^53 the midpoint of a range is not exact, so the factors run in order. Each factor
  // is n - j and has one rounding. A count of k factors, not a bound on i, so the loop ends.
  let r = 1;
  for (let j = k - 1; j >= 0; j--) r *= n - j;
  return r;
}

/**
 * `permutations` of two BigNumbers: the exact product (n - k + 1) * … * n, rounded one time to the precision.
 * @throws TypeError when an argument is not a non-negative integer, or when `k > n`
 * @throws RangeError when the loop would need more than the supported number of steps
 */
function permutationsBigNumber(n: BigNumber, k: BigNumber): BigNumber {
  assertNonNegativeIntegers('permutations', n, k);
  if (k.greaterThan(n)) {
    throw new TypeError('second argument k must be less than or equal to first argument n');
  }
  const total = n.toBigInt();
  const chosen = k.toBigInt();
  assertLoopOrder('permutations', 'k', Number(chosen));
  return roundedRangeProduct(total - chosen + 1n, total);
}

/**
 * Compute the number of ordered subsets of k elements from n elements:
 * P(n, k) = n! / (n-k)!
 *
 * When called with a single argument, returns n! (all permutations of n items).
 * Two BigNumbers (or a BigNumber and a number) give the exact value as a BigNumber, rounded one
 * time to the precision. An Array or a Matrix of `n` (or of `k`) gives the collection of the results.
 *
 * @example
 * permutations(5)     // 120  (= 5!)
 * permutations(5, 3)  // 60   (= 5*4*3)
 */
export const permutations = /* #__PURE__ */ unaryCollectionCallback(
  mathTyped('permutations', {
    number: permutationsOfNumber,
    'bigint | Fraction': (n: bigint | Fraction): number => permutationsOfNumber(scalarToNumber(n)),
    BigNumber: (n: BigNumber): BigNumber => {
      if (!n.isInteger()) throw new Error('Integer BigNumber expected');
      if (n.isNegative()) throw new Error('Value must be non-negative');
      assertLoopOrder('permutations', 'n', n.toNumber());
      return roundedRangeProduct(1n, n.toBigInt());
    },
    'number, number': permutationsOfNumbers,
    'bigint | Fraction, number | bigint | Fraction': (
      n: bigint | Fraction,
      k: number | bigint | Fraction
    ): number => permutationsOfNumbers(scalarToNumber(n), scalarToNumber(k)),
    'number, bigint | Fraction': (n: number, k: bigint | Fraction): number =>
      permutationsOfNumbers(n, scalarToNumber(k)),
    'BigNumber, BigNumber': permutationsBigNumber,
    'BigNumber, number': (n: BigNumber, k: number): BigNumber =>
      permutationsBigNumber(n, BigNumber.fromNumber(k)),
    'number, BigNumber': (n: number, k: BigNumber): BigNumber =>
      permutationsBigNumber(BigNumber.fromNumber(n), k),
    'Array | Matrix': mathTyped.referToSelf(
      (self) =>
        (n: unknown[] | Matrix): unknown[] | Matrix =>
          deepMap(n as unknown[], (v) => (self as (a: unknown) => unknown)(v)) as unknown[] | Matrix
    ),
    'Array | Matrix, number | BigNumber': mathTyped.referToSelf(
      (self) =>
        (n: unknown[] | Matrix, k: number | BigNumber): unknown[] | Matrix =>
          deepMap(n as unknown[], (nVal) =>
            (self as (a: unknown, b: unknown) => unknown)(nVal, k)
          ) as unknown[] | Matrix
    ),
    'number | BigNumber, Array | Matrix': mathTyped.referToSelf(
      (self) =>
        (n: number | BigNumber, k: unknown[] | Matrix): unknown[] | Matrix =>
          deepMap(k as unknown[], (kVal) =>
            (self as (a: unknown, b: unknown) => unknown)(n, kVal)
          ) as unknown[] | Matrix
    ),
  })
);

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
type Draw = (...args: number[]) => unknown;

/**
 * A signature that takes a size (an Array or a Matrix of dimension lengths). The signature fills
 * an array of that size with draws of the typed function itself. A Matrix size gives a matrix.
 */
function sized(fn: string, draw: (self: Draw, ...args: number[]) => unknown) {
  return mathTyped.referToSelf((self) => (size: unknown[] | Matrix, ...args: number[]) => {
    const dims = (Array.isArray(size) ? size : (size.toArray() as unknown[])) as number[];
    assertAllocSize(fn, dims);
    const fill = (d: number): unknown =>
      d === dims.length
        ? draw(self as Draw, ...args)
        : Array.from({ length: dims[d] }, () => fill(d + 1));
    const out = fill(0);
    // The size is the requested size: the nested form `[]` of a 0 x 3 result does not show it.
    return Array.isArray(size) ? out : denseOfSize(out as number[][], dims);
  });
}

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
  // A size (an Array or a Matrix) gives an array of that size, as in mathjs.
  'Array | Matrix': sized('random', (self) => self()),
  'Array | Matrix, number': sized('random', (self, max) => self(max)),
  'Array | Matrix, number, number': sized('random', (self, min, max) => self(min, max)),
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
  'Array | Matrix': sized('randomInt', (self) => self()),
  'Array | Matrix, number': sized('randomInt', (self, max) => self(max)),
  'Array | Matrix, number, number': sized('randomInt', (self, min, max) => self(min, max)),
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
  // mathjs picks from all entries, and flattens a nested array or a matrix first.
  'Array | Matrix': (arr: unknown[] | Matrix): unknown => _pick(entries(arr), 1, undefined)[0],
  'Array | Matrix, number': (arr: unknown[] | Matrix, n: number): unknown[] =>
    _pick(entries(arr), n, undefined),
  'Array | Matrix, Array': (arr: unknown[] | Matrix, weights: number[]): unknown =>
    _pick(entries(arr), 1, weights)[0],
  'Array | Matrix, number, Array': (arr: unknown[] | Matrix, n: number, weights: number[]) =>
    _pick(entries(arr), n, weights),
  'Array | Matrix, Array, number': (arr: unknown[] | Matrix, weights: number[], n: number) =>
    _pick(entries(arr), n, weights),
});

/** All entries of an array or a matrix, in row order. */
function entries(x: unknown[] | Matrix): unknown[] {
  return (Array.isArray(x) ? x : (x.toArray() as unknown[])).flat(Infinity);
}

/**
 * Internal weighted/unweighted sampling with replacement.
 */
function _pick(arr: unknown[], n: number, weights: number[] | undefined): unknown[] {
  if (arr.length === 0) throw new RangeError('Cannot pick from an empty array');
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError('number of picks must be a positive integer');
  }
  assertLoopOrder('pickRandom', 'n', n);
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
