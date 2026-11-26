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
  FRACTION_TO_BIGNUMBER_ERROR,
  isBigNumberLike,
  isComplexLike,
  isFractionLike,
  isMatrixLikeValue,
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

/** mathjs `pinv` / `inv` singular-matrix message (factory rank-factorization path). */
export const PINV_DETERMINANT_ZERO = 'Cannot calculate inverse, determinant is zero';

type Scalar = unknown;
type ScalarMatrix = Scalar[] | Scalar[][];

function isNumberNestedMatrix(x: unknown): boolean {
  if (!Array.isArray(x)) return false;
  const visit = (entry: unknown): boolean => {
    if (typeof entry === 'number') return true;
    if (Array.isArray(entry)) return entry.every(visit);
    return false;
  };
  return visit(x);
}

function matrixData(x: unknown, isMatrix: (v: unknown) => boolean): Scalar[][] | null {
  if (Array.isArray(x)) return x as Scalar[][];
  if (isMatrix(x)) return (x as { valueOf: () => Scalar[][] }).valueOf();
  return null;
}

function nestedArraySize(x: ScalarMatrix): number[] {
  const s: number[] = [];
  let current: unknown = x;
  while (Array.isArray(current)) {
    s.push(current.length);
    current = current[0];
  }
  return s;
}

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
  inv: AnyFn;
  deepEqual: AnyFn;
  dotDivide: AnyFn;
  dot: AnyFn;
  ctranspose: AnyFn;
  multiply: AnyFn;
  add: AnyFn;
  matrix: (data: unknown, storage?: 'dense' | 'sparse') => unknown;
  complex: (re: number, im: number) => unknown;
  isMatrix: (x: unknown) => boolean;
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
function mathjsPinvMatrix(
  x: unknown,
  deps: CompatPinvDependencies
): Scalar | Scalar[] | Scalar[][] | unknown {
  const {
    inv,
    deepEqual,
    equal,
    dotDivide,
    dot,
    ctranspose,
    multiply,
    add,
    matrix,
    complex,
    isMatrix,
  } = deps;
  const Complex = (re: number, im: number) => complex(re, im);
  const size = isMatrix(x)
    ? (x as { size: () => number[] }).size()
    : nestedArraySize(x as ScalarMatrix);
  const isZero = (s: Scalar): boolean =>
    equal(add(s, Complex(1, 1)), add(0, Complex(1, 1))) === true;
  const isZeros = (arr: unknown): boolean =>
    deepEqual(add(arr, Complex(1, 1)), add(multiply(arr, 0), Complex(1, 1))) === true;

  const _pinv = (mat: Scalar[][], rows: number, cols: number): Scalar[][] => {
    const { C, F } = _rankFact(mat, rows, cols);
    const Cpinv = multiply(inv(multiply(ctranspose(C), C)), ctranspose(C));
    const Fpinv = multiply(ctranspose(F), inv(multiply(F, ctranspose(F))));
    return multiply(Fpinv, Cpinv) as Scalar[][];
  };

  function _rankFact(
    mat: Scalar[][],
    rows: number,
    cols: number
  ): { C: Scalar[][]; F: Scalar[][] } {
    const rref = _rref(mat, rows, cols);
    const C = mat.map((row) =>
      row.filter((_, j) => j < rows && !isZero(dot(rref[j], rref[j]) as Scalar))
    );
    const F = rref.filter((_, i) => !isZero(dot(rref[i], rref[i]) as Scalar));
    return { C, F };
  }

  function _rref(mat: Scalar[][], rows: number, cols: number): Scalar[][] {
    const M = mat.map((row) => row.slice());
    let lead = 0;
    for (let r = 0; r < rows; r++) {
      if (cols <= lead) {
        return M;
      }
      let i = r;
      while (isZero(M[i]![lead]!)) {
        i++;
        if (rows === i) {
          i = r;
          lead++;
          if (cols === lead) {
            return M;
          }
        }
      }
      [M[i], M[r]] = [M[r]!, M[i]!];
      const val = M[r]![lead]!;
      for (let j = 0; j < cols; j++) {
        M[r]![j] = dotDivide(M[r]![j], val) as Scalar;
      }
      for (let ri = 0; ri < rows; ri++) {
        if (ri === r) continue;
        let piv = M[ri]![lead]!;
        for (let j = 0; j < cols; j++) {
          M[ri]![j] = add(M[ri]![j], multiply(-1, multiply(piv, M[r]![j]!))) as Scalar;
        }
      }
      lead++;
    }
    return M;
  }

  switch (size.length) {
    case 1: {
      if (isZeros(x)) return ctranspose(x);
      if (size[0] === 1) {
        return inv(x);
      }
      return dotDivide(ctranspose(x), dot(x, x));
    }
    case 2: {
      if (isZeros(x)) return ctranspose(x);
      const rows = size[0]!;
      const cols = size[1]!;
      if (rows === cols) {
        try {
          return inv(x);
        } catch (err) {
          if (
            err instanceof Error &&
            err.message.match(/Cannot calculate inverse, determinant is zero/)
          ) {
            /* fall through to _pinv like mathjs */
          } else {
            throw err;
          }
        }
      }
      const data = isMatrix(x) ? (x as { valueOf: () => Scalar[][] }).valueOf() : (x as Scalar[][]);
      const result = _pinv(data, rows, cols);
      if (isMatrix(x)) {
        const storage = (x as { storage: () => string }).storage() as 'dense' | 'sparse';
        return matrix(result, storage);
      }
      return result;
    }
    default:
      throw new RangeError(`Matrix must be two dimensional (size: ${size.join(' x ')})`);
  }
}

/**
 * mathjs `pinv` scalar (`any`) path keeps BigNumber / Fraction / Complex types;
 * number-only Array / Matrix inputs follow the mathjs factory rank-factorization
 * path (singular `pinv([[0,1]])` throws like mathjs). Other matrix element types
 * delegate to the native typed `pinv`.
 */
export function createCompatPinv(native: AnyFn, deps: CompatPinvDependencies): AnyFn {
  const { convert, divide, equal } = deps;
  return keepSurface(native, (...args: unknown[]): unknown => {
    const converted = args.map(convert);
    if (converted.length !== 1) {
      return native(...converted);
    }
    const x = converted[0];
    if (isMatrixLikeValue(x)) {
      const data = matrixData(x, deps.isMatrix);
      if (data !== null && isNumberNestedMatrix(data)) {
        return mathjsPinvMatrix(x, deps);
      }
      return native(x);
    }
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
  if (index === 0) return promote(1);
  if (index === 1) return divide(promote(-1), promote(2));
  if (index % 2 === 1) return promote(0);
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
/** The float bernoulli cache (mathjs `numberCache`). */
const numberCache: (BernoulliTriple<number> | undefined)[] = [undefined];
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
  const bernoulliNumber = (index: number): number =>
    bernoulliCore(
      index,
      (n) => n,
      numberCache,
      (a, b) => a + b,
      (a, b) => a * b,
      (a, b) => a / b
    );
  return keepSurface(native, (...args: unknown[]): unknown => {
    const converted = args.map(convert);
    if (converted.length !== 1) {
      return native(...converted);
    }
    const x = converted[0];
    if (typeof x === 'number') {
      return bernoulliNumber(bernoulliIndex(x));
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

function hasBigNumberLike(x: unknown): boolean {
  return isOwnBigNumber(x) || isBigNumberLike(x);
}

function mixedFractionBigNumber(a: unknown, b: unknown): boolean {
  return (hasBigNumberLike(a) && isFractionLike(b)) || (isFractionLike(a) && hasBigNumberLike(b));
}

/**
 * mathjs `compare` throws `No ordering relation is defined for complex numbers`
 * for a Complex operand and rejects mixed BigNumber / Fraction pairs with the
 * implicit-conversion error. The wrapper converts foreign scalars first.
 */
export function createCompatCompare(native: AnyFn, convert: (v: unknown) => unknown): AnyFn {
  return keepSurface(native, (...args: unknown[]): unknown => {
    const converted = args.map(convert);
    for (const arg of converted) {
      if (isComplexLike(arg)) throw new TypeError(COMPLEX_ORDERING_ERROR);
    }
    if (converted.length >= 2 && mixedFractionBigNumber(converted[0], converted[1])) {
      throw new TypeError(FRACTION_TO_BIGNUMBER_ERROR);
    }
    return native(...converted);
  });
}
