/**
 * G06 — mathjs-parity adapters over the typed surface (#1554).
 *
 * The critical libraries keep their native behavior. These compat-only
 * adapters reproduce what mathjs 15.3.0 does differently at the compat
 * surface: `pinv` and `bernoulli` keep BigNumber / Fraction / Complex inputs
 * (and `config.number` through `evaluate`) instead of collapsing to `number`,
 * and the foreign-oracle scalars (mathjs-package instances) reach the compat
 * relational / unary surface instead of being brand-rejected.
 */

import {
  isBigNumberLike,
  isComplexLike,
  isFractionLike,
  isOwnBigNumber,
  keepSurface,
} from './mathjs-parity-g02.js';
import type {
  BigNumber as CompatBigNumberType,
  Fraction as CompatFractionType,
} from '@danielsimonjr/mathts-core';

type AnyFn = (...args: unknown[]) => unknown;

/** The compat BigNumber constructor. */
type BigNumberCtor = new (v?: number | string | bigint) => CompatBigNumberType;

/** The compat Fraction constructor (numerator / denominator bigints). */
type FractionCtor = new (n: bigint, d: bigint) => CompatFractionType;

/** mathjs `bernoulli` rejects a non-integer or negative index with this message. */
export const BERNOULLI_INDEX_ERROR = 'Bernoulli index must be nonnegative integer';

/** mathjs `compare` throws this for any Complex operand. */
export const COMPLEX_ORDERING_ERROR = 'No ordering relation is defined for complex numbers';

// =============================================================================
// #1554 — pinv keeps the scalar type
// =============================================================================

/** Dependencies of the compat `pinv`, taken from the compat instance surface. */
export interface CompatPinvDependencies {
  /** The shared foreign-scalar converter (oracle values in, compat values out). */
  convert: (v: unknown) => unknown;
  /** The compat `divide`, which keeps BigNumber / Fraction / Complex results. */
  divide: AnyFn;
  /** The compat `equal`, used for the scalar zero check. */
  equal: AnyFn;
}

function isScalarObject(x: unknown): boolean {
  return isOwnBigNumber(x) || isBigNumberLike(x) || isFractionLike(x) || isComplexLike(x);
}

/**
 * mathjs `pinv` scalar (`any`) path: `pinv(x)` is `1 / x` in the type of `x`,
 * and the zero value clones through unchanged (`equal(x, 0)`). The native
 * compat typed surface only lists number / matrix signatures, so a BigNumber
 * becomes a number and a Complex is rejected. Arrays and matrices delegate to
 * the native function (their element types already survive there).
 */
export function createCompatPinv(native: AnyFn, deps: CompatPinvDependencies): AnyFn {
  const { convert, divide, equal } = deps;
  return keepSurface(native, (...args: unknown[]): unknown => {
    const converted = args.map(convert);
    if (converted.length !== 1) {
      return native(...converted);
    }
    const x = converted[0];
    if (isScalarObject(x)) {
      if (equal(x, 0) === true) return x;
      return divide(1, x);
    }
    if (typeof x === 'boolean') {
      // equal(false, 0) is true in mathjs, so `pinv(false)` is `false` itself;
      // `pinv(true)` is `1 / true` — the number 1.
      return x ? 1 : x;
    }
    return native(x);
  });
}

// =============================================================================
// #1554 — bernoulli keeps the index type
// =============================================================================

/** Dependencies of the compat `bernoulli`, taken from the compat instance surface. */
export interface CompatBernoulliDependencies {
  /** The shared foreign-scalar converter (oracle values in, compat values out). */
  convert: (v: unknown) => unknown;
  BigNumberClass: BigNumberCtor;
  FractionClass: FractionCtor;
  /** The instance precision, for the BigNumber cache identity (mathjs `config.precision`). */
  precision: () => number;
}

/** One cached cotangent-coefficient triple: [a_n, prefactor, B_2n]. */
type BernoulliTriple<T> = [T, T, T];

/**
 * The mathjs `_bernoulli` recurrence (https://math.stackexchange.com/a/2844337),
 * ported verbatim with the numeric operations passed in. The cache is
 * 1-indexed like the mathjs original: slot 0 stays unused, slot i holds the
 * cotangent coefficient, prefactor, and Bernoulli number B_2i for index 2i.
 */
function bernoulliCore<T>(
  index: number,
  promote: (n: number) => T,
  cache: (BernoulliTriple<T> | undefined)[],
  plus: (a: T, b: T) => T,
  times: (a: T, b: T) => T,
  divide: (a: T, b: T) => T
): T {
  const one = promote(1);
  if (cache.length === 1) {
    cache.push([divide(one, promote(-3)), divide(one, promote(-2)), divide(one, promote(6))]);
  }
  const half = index / 2;
  const zero = promote(0);
  const two = promote(2);
  while (cache.length <= half) {
    const i = cache.length; // next cotangent coefficient to compute
    const lim = Math.floor((i + 1) / 2);
    let a = zero;
    for (let m = 1; m < lim; ++m) {
      a = plus(a, times(cache[m]![0], cache[i - m]![0]));
    }
    a = times(a, two);
    if (i % 2 === 0) a = plus(a, times(cache[lim]![0], cache[lim]![0]));
    a = divide(a, promote(-(2 * i + 1)));
    const prefactor = divide(times(cache[i - 1]![1], promote(-i * (2 * i - 1))), two);
    cache.push([a, prefactor, times(prefactor, a)]);
  }
  return cache[half]![2];
}

/** The exact Fraction bernoulli cache (mathjs `fractionCache`). */
const fractionCache: (BernoulliTriple<CompatFractionType> | undefined)[] = [undefined];
/** The BigNumber bernoulli caches, one per precision (mathjs `bigCache`). */
const bigCaches = new Map<number, (BernoulliTriple<CompatBigNumberType> | undefined)[]>();

function bernoulliIndex(x: unknown): number {
  const index = Number(x);
  if (index < 0 || !Number.isInteger(index)) throw new RangeError(BERNOULLI_INDEX_ERROR);
  return index;
}

/**
 * mathjs `bernoulli`: a number index keeps the native number path; a bigint or
 * Fraction index returns the exact Fraction; a BigNumber index returns a
 * BigNumber at the instance precision. The native compat surface collapses
 * every input to a number, so the compat surface reproduces the mathjs
 * signatures here. A non-integer or negative index throws the mathjs message.
 */
export function createCompatBernoulli(native: AnyFn, deps: CompatBernoulliDependencies): AnyFn {
  const { convert, BigNumberClass, FractionClass, precision } = deps;
  const bernoulliFraction = (index: number): CompatFractionType =>
    bernoulliCore(
      index,
      (n) => new FractionClass(BigInt(n), 1n),
      fractionCache,
      (a, b) => a.add(b) as CompatFractionType,
      (a, b) => a.mul(b) as CompatFractionType,
      (a, b) => a.div(b) as CompatFractionType
    );
  const bernoulliBig = (index: number): CompatBigNumberType => {
    const atPrecision = precision();
    let cache = bigCaches.get(atPrecision);
    if (cache === undefined) {
      cache = [undefined];
      bigCaches.set(atPrecision, cache);
    }
    return bernoulliCore(
      index,
      (n) => new BigNumberClass(n),
      cache,
      (a, b) => a.add(b) as CompatBigNumberType,
      (a, b) => a.mul(b) as CompatBigNumberType,
      (a, b) => a.div(b) as CompatBigNumberType
    );
  };
  return keepSurface(native, (...args: unknown[]): unknown => {
    const converted = args.map(convert);
    if (converted.length !== 1) {
      return native(...converted);
    }
    const x = converted[0];
    if (typeof x === 'number') {
      return native(bernoulliIndex(x));
    }
    if (typeof x === 'bigint' || isFractionLike(x)) {
      return bernoulliFraction(bernoulliIndex(x));
    }
    if (isOwnBigNumber(x) || isBigNumberLike(x)) {
      return bernoulliBig(bernoulliIndex(x));
    }
    return native(x);
  });
}

// =============================================================================
// #1554 — compare rejects Complex the way mathjs does
// =============================================================================

/**
 * mathjs `compare` throws `No ordering relation is defined for complex numbers`
 * for a Complex operand; the compat typed surface rejects the Complex with the
 * generic argument error instead. The wrapper converts the foreign scalars
 * first, then raises the mathjs error.
 */
export function createCompatCompare(native: AnyFn, convert: (v: unknown) => unknown): AnyFn {
  return keepSurface(native, (...args: unknown[]): unknown => {
    const converted = args.map(convert);
    for (const arg of converted) {
      if (isComplexLike(arg)) throw new TypeError(COMPLEX_ORDERING_ERROR);
    }
    return native(...converted);
  });
}
