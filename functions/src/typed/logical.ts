/**
 * Typed Logical Functions
 *
 * Polymorphic logical operations using typed-function for runtime dispatch.
 * Supports number, bigint, BigNumber, and Complex types.
 *
 * Truthiness rules (a value is FALSY if):
 *   - number:    === 0 or NaN
 *   - bigint:    === 0n
 *   - BigNumber: .isZero() || .isNaN()
 *   - Complex:   re === 0 && im === 0
 *   - any:       JS-falsy (null, undefined, '', false, 0, 0n, NaN)
 *
 * These match the mathjs `and`/`or`/`xor`/`not` semantics exactly.
 *
 * @packageDocumentation
 */

import {
  mathTyped,
  Complex,
  BigNumber,
} from '@danielsimonjr/mathts-core';

// =============================================================================
// Internal helpers
// =============================================================================

/** Return true when a number is logically truthy (not 0 and not NaN) */
function isTruthyNumber(x: number): boolean {
  return x !== 0 && !Number.isNaN(x);
}

/** Return true when a BigNumber is logically truthy */
function isTruthyBigNumber(x: BigNumber): boolean {
  return !x.isZero() && !x.isNaN();
}

/** Return true when a Complex is logically truthy (not the zero complex) */
function isTruthyComplex(x: Complex): boolean {
  return x.re !== 0 || x.im !== 0;
}

/** Return true when an arbitrary value is logically truthy (JS semantics) */
function isTruthy(x: unknown): boolean {
  return !!x;
}

// =============================================================================
// not — logical NOT
// =============================================================================

/**
 * Logical `not`. Flips the boolean value of a given parameter.
 *
 * @example
 * ```typescript
 * not(2)      // false
 * not(0)      // true
 * not(true)   // false
 * ```
 */
export const not = mathTyped('not', {
  'any': (x: unknown): boolean => !isTruthy(x),

  'number': (x: number): boolean => !isTruthyNumber(x),

  'bigint': (x: bigint): boolean => x === 0n,

  'BigNumber': (x: BigNumber): boolean => !isTruthyBigNumber(x),

  'Complex': (x: Complex): boolean => !isTruthyComplex(x),
});

// =============================================================================
// and — logical AND
// =============================================================================

/**
 * Logical `and`. Returns true when both inputs are truthy (non-zero/non-empty).
 *
 * @example
 * ```typescript
 * and(1, 2)   // true
 * and(0, 2)   // false
 * and(1, 2, 3) // true  (variadic)
 * ```
 */
export const and = mathTyped('and', {
  'any, any': (a: unknown, b: unknown): boolean => isTruthy(a) && isTruthy(b),

  'number, number': (a: number, b: number): boolean =>
    isTruthyNumber(a) && isTruthyNumber(b),

  'bigint, bigint': (a: bigint, b: bigint): boolean => a !== 0n && b !== 0n,

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean =>
    isTruthyBigNumber(a) && isTruthyBigNumber(b),

  'Complex, Complex': (a: Complex, b: Complex): boolean =>
    isTruthyComplex(a) && isTruthyComplex(b),

  // Variadic: reduce-and over three or more arbitrary values.
  // Note: typed-function passes rest args as [[val1, val2, ...]], so rest[0]
  // is the flat array of remaining values.
  'any, any, ...any': (a: unknown, b: unknown, ...rest: unknown[]): boolean => {
    const restArr = rest[0] as unknown[];
    return isTruthy(a) && isTruthy(b) && restArr.every(isTruthy);
  },
});

// =============================================================================
// or — logical OR
// =============================================================================

/**
 * Logical `or`. Returns true when at least one input is truthy.
 *
 * @example
 * ```typescript
 * or(0, 2)    // true
 * or(0, 0)    // false
 * or(0, 0, 1) // true  (variadic)
 * ```
 */
export const or = mathTyped('or', {
  'any, any': (a: unknown, b: unknown): boolean => isTruthy(a) || isTruthy(b),

  'number, number': (a: number, b: number): boolean =>
    isTruthyNumber(a) || isTruthyNumber(b),

  'bigint, bigint': (a: bigint, b: bigint): boolean => a !== 0n || b !== 0n,

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean =>
    isTruthyBigNumber(a) || isTruthyBigNumber(b),

  'Complex, Complex': (a: Complex, b: Complex): boolean =>
    isTruthyComplex(a) || isTruthyComplex(b),

  // Variadic: reduce-or over three or more arbitrary values.
  // Note: typed-function passes rest args as [[val1, val2, ...]], so rest[0]
  // is the flat array of remaining values.
  'any, any, ...any': (a: unknown, b: unknown, ...rest: unknown[]): boolean => {
    const restArr = rest[0] as unknown[];
    return isTruthy(a) || isTruthy(b) || restArr.some(isTruthy);
  },
});

// =============================================================================
// xor — logical XOR
// =============================================================================

/**
 * Logical `xor`. Returns true when exactly one input is truthy.
 *
 * @example
 * ```typescript
 * xor(1, 0)   // true
 * xor(1, 2)   // false
 * xor(1, 0, 0) // true  (variadic: odd number of truthy values)
 * ```
 */
export const xor = mathTyped('xor', {
  'any, any': (a: unknown, b: unknown): boolean => isTruthy(a) !== isTruthy(b),

  'number, number': (a: number, b: number): boolean =>
    isTruthyNumber(a) !== isTruthyNumber(b),

  'bigint, bigint': (a: bigint, b: bigint): boolean => (a !== 0n) !== (b !== 0n),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean =>
    isTruthyBigNumber(a) !== isTruthyBigNumber(b),

  'Complex, Complex': (a: Complex, b: Complex): boolean =>
    isTruthyComplex(a) !== isTruthyComplex(b),

  // Variadic: reduce-xor over three or more values (true when odd count are truthy).
  // Note: typed-function passes rest args as [[val1, val2, ...]], so rest[0]
  // is the flat array of remaining values.
  'any, any, ...any': (a: unknown, b: unknown, ...rest: unknown[]): boolean => {
    const restArr = rest[0] as unknown[];
    let result = isTruthy(a) !== isTruthy(b);
    for (const v of restArr) {
      result = result !== isTruthy(v);
    }
    return result;
  },
});

// =============================================================================
// nullish — nullish coalescing (??)
// =============================================================================

/**
 * Nullish coalescing operator (??).
 * Returns `b` when `a` is `null` or `undefined`, otherwise returns `a`.
 *
 * Unlike `or`, a value of `0`, `false`, or `''` is NOT considered nullish.
 *
 * @example
 * ```typescript
 * nullish(null, 5)        // 5
 * nullish(undefined, 5)  // 5
 * nullish(0, 5)          // 0   (not nullish!)
 * nullish(false, 5)      // false
 * ```
 */
export const nullish = mathTyped('nullish', {
  // Concrete numeric types: always return a (never null/undefined)
  'number, any': (a: number, _b: unknown): number => a,
  'bigint, any': (a: bigint, _b: unknown): bigint => a,
  'BigNumber, any': (a: BigNumber, _b: unknown): BigNumber => a,
  'Complex, any': (a: Complex, _b: unknown): Complex => a,

  // Explicit boolean: return a as-is (false is NOT nullish)
  // Must be declared before 'any,any' to prevent boolean→number conversion
  'boolean, any': (a: boolean, _b: unknown): boolean => a,

  // Explicit string: return a as-is ('' is NOT nullish)
  // Must be declared before 'any,any' to prevent string→Complex conversion
  'string, any': (a: string, _b: unknown): string => a,

  // Generic any,any covers null/undefined on either side.
  // Since typed-function would convert known types above, this signature
  // effectively receives only null, undefined, or unconvertible values.
  'any, any': (a: unknown, b: unknown): unknown => a ?? b,
});

// =============================================================================
// Barrel export
// =============================================================================

/**
 * All typed logical functions.
 */
export const typedLogical = {
  not,
  and,
  or,
  xor,
  nullish,
};
