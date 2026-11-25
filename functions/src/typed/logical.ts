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

import { collectionBinary, collectionBinaryRows } from './collection-binary.js';
import { mathTyped, Complex, BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import type { UnitInstance as Unit } from '@danielsimonjr/mathts-core';
import { mapEachLeaf } from './f64-kernels.js';

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

/** Truthiness of a Unit matches mathjs: test the numeric `value`, not object presence. */
function isTruthyUnit(x: Unit): boolean {
  const v = x.value;
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return isTruthyNumber(v);
  if (typeof v === 'bigint') return v !== 0n;
  if (v instanceof BigNumber) return isTruthyBigNumber(v);
  if (v instanceof Complex) return isTruthyComplex(v);
  return isTruthy(v);
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
  any: (x: unknown): boolean => !isTruthy(x),

  number: (x: number): boolean => !isTruthyNumber(x),

  bigint: (x: bigint): boolean => x === 0n,

  BigNumber: (x: BigNumber): boolean => !isTruthyBigNumber(x),

  Complex: (x: Complex): boolean => !isTruthyComplex(x),

  Unit: (x: Unit): boolean => !isTruthyUnit(x),

  'Array | Matrix': mapEachLeaf((self, x) => self(x)),
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
  ...collectionBinaryRows('and'),
  'any, any': (a: unknown, b: unknown): boolean => isTruthy(a) && isTruthy(b),

  'number, number': (a: number, b: number): boolean => isTruthyNumber(a) && isTruthyNumber(b),

  'bigint, bigint': (a: bigint, b: bigint): boolean => a !== 0n && b !== 0n,

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean =>
    isTruthyBigNumber(a) && isTruthyBigNumber(b),

  'Complex, Complex': (a: Complex, b: Complex): boolean => isTruthyComplex(a) && isTruthyComplex(b),

  'Unit, Unit': (a: Unit, b: Unit): boolean => isTruthyUnit(a) && isTruthyUnit(b),

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
  ...collectionBinaryRows('or'),
  'any, any': (a: unknown, b: unknown): boolean => isTruthy(a) || isTruthy(b),

  'number, number': (a: number, b: number): boolean => isTruthyNumber(a) || isTruthyNumber(b),

  'bigint, bigint': (a: bigint, b: bigint): boolean => a !== 0n || b !== 0n,

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean =>
    isTruthyBigNumber(a) || isTruthyBigNumber(b),

  'Complex, Complex': (a: Complex, b: Complex): boolean => isTruthyComplex(a) || isTruthyComplex(b),

  'Unit, Unit': (a: Unit, b: Unit): boolean => isTruthyUnit(a) || isTruthyUnit(b),

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
  ...collectionBinaryRows('xor'),
  'any, any': (a: unknown, b: unknown): boolean => isTruthy(a) !== isTruthy(b),

  'number, number': (a: number, b: number): boolean => isTruthyNumber(a) !== isTruthyNumber(b),

  'bigint, bigint': (a: bigint, b: bigint): boolean => (a !== 0n) !== (b !== 0n),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean =>
    isTruthyBigNumber(a) !== isTruthyBigNumber(b),

  'Complex, Complex': (a: Complex, b: Complex): boolean =>
    isTruthyComplex(a) !== isTruthyComplex(b),

  'Unit, Unit': (a: Unit, b: Unit): boolean => isTruthyUnit(a) !== isTruthyUnit(b),

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

/** Factory nullish when the first argument is a collection; omit reverse `any, Matrix` rows. */
function nullishCollectionFirstRows(): Record<string, (a: unknown, b: unknown) => unknown> {
  const call = (a: unknown, b: unknown): unknown => collectionBinary('nullish')(a, b);
  return {
    'Array, any': call,
    'DenseMatrix, any': call,
    'SparseMatrix, any': call,
  };
}

export const nullish = mathTyped('nullish', {
  // Scalars first so (Complex, number) does not fall into `any, DenseMatrix` collection rows.
  // No `any, any` (mathjs throws TypeError on plain objects).
  'number, any': (a: number, _b: unknown): number => a,
  'bigint, any': (a: bigint, _b: unknown): bigint => a,
  'BigNumber, any': (a: BigNumber, _b: unknown): BigNumber => a,
  'Complex, any': (a: Complex, _b: unknown): Complex => a,
  'Fraction, any': (a: Fraction, _b: unknown): Fraction => a,
  'Unit, any': (a: Unit, _b: unknown): Unit => a,
  'boolean, any': (a: boolean, _b: unknown): boolean => a,
  'string, any': (a: string, _b: unknown): string => a,
  'null, any': (_a: null, b: unknown): unknown => b,
  'undefined, any': (_a: undefined, b: unknown): unknown => b,

  // Collections when the left operand is a collection (no `any, Array` rows — those break scalar pairs).
  ...nullishCollectionFirstRows(),
}) as {
  <Left, Right>(left: Left, right: Right): Left extends null | undefined ? Right : Left;
  readonly signatures: Readonly<Record<string, (...args: unknown[]) => unknown>>;
};

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
