/**
 * Typed Relational Functions
 *
 * Polymorphic relational operations using typed-function for runtime dispatch.
 * Supports number, BigNumber, Fraction, Complex, bigint, boolean, string, and Array types.
 *
 * These are clean implementations using mathTyped dispatch — the dormant synced
 * layer under functions/src/relational/ is left untouched and used only as an
 * algorithm reference.
 *
 * Semantics follow the mathjs convention:
 *   - nearlyEqual tolerance uses DEFAULT_CONFIG.relTol / absTol.
 *   - deepEqual recurses over nested arrays; non-array scalars delegate to equalScalar.
 *   - compareNatural orders mixed types by type name (natural sort) as a tiebreak.
 *   - compareText is pure lexicographic (locale-independent).
 *   - equalText delegates to compareText === 0.
 *   - equalScalar uses tolerance for number/BigNumber/Complex; exact for others.
 *   - unequal is the negation of equalScalar (with null/undefined strict handling).
 *   - compareUnits requires same-base units; delegates value comparison recursively.
 *
 * @packageDocumentation
 */

import naturalSort from 'javascript-natural-sort';
import { mathTyped, Complex, BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import { nearlyEqual } from '../utils/number.js';

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Relative tolerance for scalar comparisons.
 * Mirrors ConfigOptions.relTol from the mathjs-synced layer (1e-12 default).
 */
const REL_TOL = 1e-12;

/**
 * Absolute tolerance for scalar comparisons.
 * Mirrors ConfigOptions.absTol from the mathjs-synced layer (1e-15 default).
 */
const ABS_TOL = 1e-15;

/**
 * Nearly-equal check for two numbers using the configured tolerances.
 */
function numbersNearlyEqual(x: number, y: number): boolean {
  return nearlyEqual(x, y, REL_TOL, ABS_TOL);
}

/**
 * Nearly-equal check for two BigNumbers using the configured tolerances.
 * Converts to number for the tolerance check — sufficient for reasonable magnitudes.
 */
function bigNumbersNearlyEqual(x: BigNumber, y: BigNumber): boolean {
  if (x.equals(y)) return true;
  const xn = x.toNumber();
  const yn = y.toNumber();
  return nearlyEqual(xn, yn, REL_TOL, ABS_TOL);
}

/**
 * Nearly-equal check for two Complex numbers (real and imaginary parts).
 */
function complexNearlyEqual(x: Complex, y: Complex): boolean {
  return numbersNearlyEqual(x.re, y.re) && numbersNearlyEqual(x.im, y.im);
}

/**
 * Determine the mathjs-style type name of a value.
 * Used by compareNatural for cross-type ordering.
 */
function typeNameOf(x: unknown): string {
  if (x === null) return 'null';
  if (x === undefined) return 'undefined';
  if (typeof x === 'boolean') return 'boolean';
  if (typeof x === 'number') return 'number';
  if (typeof x === 'bigint') return 'bigint';
  if (typeof x === 'string') return 'string';
  if (x instanceof Complex) return 'Complex';
  if (x instanceof BigNumber) return 'BigNumber';
  if (x instanceof Fraction) return 'Fraction';
  if (Array.isArray(x)) return 'Array';
  if (typeof x === 'object') return 'Object';
  return typeof x;
}

/**
 * Compare two arrays element-by-element using a comparator.
 * Longer array wins if all shared prefix elements are equal.
 */
function compareArrays(
  cmp: (a: unknown, b: unknown) => number,
  x: unknown[],
  y: unknown[]
): number {
  const len = Math.min(x.length, y.length);
  for (let i = 0; i < len; i++) {
    const c = cmp(x[i], y[i]);
    if (c !== 0) return c;
  }
  return x.length > y.length ? 1 : x.length < y.length ? -1 : 0;
}

/**
 * Compare two plain objects by sorted keys, then by values.
 */
function compareObjects(
  cmp: (a: unknown, b: unknown) => number,
  x: Record<string, unknown>,
  y: Record<string, unknown>
): number {
  const kx = Object.keys(x).sort(naturalSort as (a: string, b: string) => number);
  const ky = Object.keys(y).sort(naturalSort as (a: string, b: string) => number);
  const kc = compareArrays(cmp, kx, ky);
  if (kc !== 0) return kc;
  for (let i = 0; i < kx.length; i++) {
    const vc = cmp(x[kx[i]], y[ky[i]]);
    if (vc !== 0) return vc;
  }
  return 0;
}

// =============================================================================
// equalScalar — scalar tolerance-aware equality
// =============================================================================

/**
 * Test whether two scalar values are nearly equal.
 *
 * Uses configured relTol / absTol for number, BigNumber, and Complex.
 * Uses exact equality for Fraction, bigint, and boolean.
 * null and undefined only equal themselves.
 *
 * @example
 * ```typescript
 * equalScalar(1, 1)                             // true
 * equalScalar(1, 1 + 1e-16)                     // true (within tolerance)
 * equalScalar(new Fraction(1, 3), new Fraction(1, 3))  // true
 * equalScalar(null, null)                        // true
 * equalScalar(null, 0)                           // false
 * ```
 */
export const equalScalar = mathTyped('equalScalar', {
  'boolean, boolean': (x: boolean, y: boolean): boolean => x === y,

  'number, number': (x: number, y: number): boolean => numbersNearlyEqual(x, y),

  'bigint, bigint': (x: bigint, y: bigint): boolean => x === y,

  'BigNumber, BigNumber': (x: BigNumber, y: BigNumber): boolean => bigNumbersNearlyEqual(x, y),

  'Fraction, Fraction': (x: Fraction, y: Fraction): boolean => x.equals(y),

  'Complex, Complex': (x: Complex, y: Complex): boolean => complexNearlyEqual(x, y),

  'string, string': (x: string, y: string): boolean => x === y,

  // null / undefined strict identity
  'null, null': (_x: null, _y: null): boolean => true,

  'any, any': (x: unknown, y: unknown): boolean => {
    if (x === null || y === null) return x === null && y === null;
    if (x === undefined || y === undefined) return x === undefined && y === undefined;
    // Fallback: structural string comparison for unrecognised types
    return JSON.stringify(x) === JSON.stringify(y);
  },
});

// =============================================================================
// unequal — negation of equalScalar with null/undefined strict handling
// =============================================================================

/**
 * Test whether two values are unequal.
 *
 * null and undefined are compared strictly: null is only equal to null,
 * undefined is only equal to undefined.
 *
 * @example
 * ```typescript
 * unequal(2 + 2, 3)       // true
 * unequal(2 + 2, 4)       // false
 * unequal(0, null)         // true
 * ```
 */
export const unequal = mathTyped('unequal', {
  'any, any': (x: unknown, y: unknown): boolean => {
    if (x === null) return y !== null;
    if (y === null) return x !== null;
    if (x === undefined) return y !== undefined;
    if (y === undefined) return x !== undefined;
    return !equalScalar(x, y);
  },
});

// =============================================================================
// deepEqual — element-wise recursive equality over arrays/scalars
// =============================================================================

/**
 * Test element-wise whether two arrays (or scalars) are equal.
 *
 * For arrays: recursively tests each element pair; arrays of different lengths
 * are unequal. For scalars: delegates to equalScalar.
 *
 * @example
 * ```typescript
 * deepEqual(2, 4)               // false
 * deepEqual([2, 5, 1], [2, 5, 1])  // true
 * deepEqual([2, 5, 1], [2, 7, 1])  // false
 * deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 4]])  // true
 * ```
 */
export const deepEqual = mathTyped('deepEqual', {
  'any, any': (x: unknown, y: unknown): boolean => {
    return _deepEqual(
      (x as { valueOf?: () => unknown }).valueOf ? (x as { valueOf: () => unknown }).valueOf() : x,
      (y as { valueOf?: () => unknown }).valueOf ? (y as { valueOf: () => unknown }).valueOf() : y
    );
  },
});

function _deepEqual(x: unknown, y: unknown): boolean {
  if (Array.isArray(x)) {
    if (!Array.isArray(y)) return false;
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) {
      if (!_deepEqual(x[i], y[i])) return false;
    }
    return true;
  }
  if (Array.isArray(y)) return false;
  return equalScalar(x, y) as boolean;
}

// =============================================================================
// compareText — lexicographic string comparison
// =============================================================================

/**
 * Compare two strings lexically (case-sensitive, locale-independent).
 * Returns 1 when x > y, -1 when x < y, and 0 when x == y.
 *
 * @example
 * ```typescript
 * compareText('B', 'A')   // 1
 * compareText('2', '10')  // 1  (lexicographic; '2' > '1')
 * compareText('a', 'a')   // 0
 * ```
 */
export const compareText = mathTyped('compareText', {
  'string, string': (x: string, y: string): number => {
    return x < y ? -1 : x > y ? 1 : 0;
  },

  'any, any': (x: unknown, y: unknown): number => {
    const sx = String(x);
    const sy = String(y);
    return sx < sy ? -1 : sx > sy ? 1 : 0;
  },
});

// =============================================================================
// equalText — string equality (compareText === 0)
// =============================================================================

/**
 * Check equality of two strings. Comparison is case-sensitive.
 *
 * @example
 * ```typescript
 * equalText('Hello', 'Hello')  // true
 * equalText('a', 'A')          // false
 * ```
 */
export const equalText = mathTyped('equalText', {
  'any, any': (x: unknown, y: unknown): boolean => {
    return (compareText(x, y) as number) === 0;
  },
});

// =============================================================================
// compareNatural — natural sort comparison across mixed types
// =============================================================================

/**
 * Compare two values of any type in a deterministic, natural way.
 *
 * For numeric types (number, BigNumber, Fraction), uses tolerance-aware comparison.
 * For strings, uses natural sort (so "10" > "2").
 * For Complex numbers, compares real part first then imaginary.
 * For arrays, compares element-by-element then by length.
 * For objects, compares sorted keys then values.
 * For mixed types, orders by type name (natural sort as tiebreak).
 *
 * Returns 1 when x > y, -1 when x < y, and 0 when x == y.
 *
 * @example
 * ```typescript
 * compareNatural(6, 1)                // 1
 * compareNatural('10', '2')           // 1  (natural sort)
 * compareNatural([1, 2, 4], [1, 2, 3])  // 1
 * compareNatural({a: 2}, {a: 4})     // -1
 * ```
 */
export const compareNatural = mathTyped('compareNatural', {
  'any, any': (x: unknown, y: unknown): number => _compareNatural(x, y),
});

function _compareNatural(x: unknown, y: unknown): number {
  const typeX = typeNameOf(x);
  const typeY = typeNameOf(y);

  // Numeric types — use tolerant comparison, tiebreak by type name
  const numericTypes = new Set(['number', 'BigNumber', 'Fraction', 'bigint']);
  if (numericTypes.has(typeX) && numericTypes.has(typeY)) {
    const c = _numericCompare(x, y);
    if (c !== 0) return c;
    return naturalSort(typeX, typeY) as number;
  }

  // Array types — element-by-element, then length, then type tiebreak
  if (typeX === 'Array' || typeY === 'Array') {
    const ax = Array.isArray(x) ? x : [x];
    const ay = Array.isArray(y) ? y : [y];
    const c = compareArrays(_compareNatural, ax, ay);
    if (c !== 0) return c;
    return naturalSort(typeX, typeY) as number;
  }

  // Different types: order by type name
  if (typeX !== typeY) {
    return naturalSort(typeX, typeY) as number;
  }

  // Same type dispatch
  if (typeX === 'Complex') {
    const cx = x as Complex;
    const cy = y as Complex;
    if (cx.re > cy.re) return 1;
    if (cx.re < cy.re) return -1;
    if (cx.im > cy.im) return 1;
    if (cx.im < cy.im) return -1;
    return 0;
  }

  if (typeX === 'boolean') {
    return (x as boolean) === (y as boolean) ? 0 : (x as boolean) ? 1 : -1;
  }

  if (typeX === 'string') {
    return naturalSort(x as string, y as string) as number;
  }

  if (typeX === 'Object') {
    return compareObjects(
      _compareNatural,
      x as Record<string, unknown>,
      y as Record<string, unknown>
    );
  }

  if (typeX === 'null' || typeX === 'undefined') {
    return 0;
  }

  throw new TypeError('Unsupported type for compareNatural: "' + typeX + '"');
}

/**
 * Compare two values of potentially mixed numeric types, returning -1, 0, or 1.
 */
function _numericCompare(x: unknown, y: unknown): number {
  // Coerce both to number for comparison (covers BigNumber, Fraction, bigint)
  let nx: number;
  let ny: number;

  if (x instanceof BigNumber) {
    nx = x.toNumber();
  } else if (x instanceof Fraction) {
    nx = (x as unknown as { valueOf(): number }).valueOf();
  } else if (typeof x === 'bigint') {
    nx = Number(x);
  } else {
    nx = x as number;
  }

  if (y instanceof BigNumber) {
    ny = y.toNumber();
  } else if (y instanceof Fraction) {
    ny = (y as unknown as { valueOf(): number }).valueOf();
  } else if (typeof y === 'bigint') {
    ny = Number(y);
  } else {
    ny = y as number;
  }

  if (Number.isNaN(nx) && Number.isNaN(ny)) return 0;
  if (Number.isNaN(nx)) return 1;
  if (Number.isNaN(ny)) return -1;
  return nx > ny ? 1 : nx < ny ? -1 : 0;
}

// =============================================================================
// compareUnits — compare two Unit values (requires same base)
// =============================================================================

/**
 * Interface for the duck-typed Unit object used by compareUnits.
 * The full Unit class lives in the synced layer; we duck-type here.
 */
interface DuckUnit {
  /** Test whether this unit has the same dimensional base as another. */
  equalBase(other: DuckUnit): boolean;
  /** Return the value type string (e.g. 'number', 'BigNumber'). */
  valueType(): string;
  /** The numeric value of the unit (after dimensional reduction). */
  value: unknown;
}

/**
 * Compare two Unit values.
 *
 * Both units must have the same dimensional base; otherwise an error is thrown.
 * The underlying numeric values are then compared using compareNatural.
 *
 * @example
 * ```typescript
 * // compareUnits(math.unit('5 cm'), math.unit('40 mm'))  // 1  (5 cm > 4 cm)
 * ```
 */
export const compareUnits = mathTyped('compareUnits', {
  'any, any': (x: unknown, y: unknown): number => {
    const ux = x as DuckUnit;
    const uy = y as DuckUnit;

    // Both must be Unit-like (duck typing: have equalBase method)
    if (
      typeof (ux as { equalBase?: unknown }).equalBase !== 'function' ||
      typeof (uy as { equalBase?: unknown }).equalBase !== 'function'
    ) {
      throw new TypeError('compareUnits: both arguments must be Unit values');
    }

    if (!ux.equalBase(uy)) {
      throw new Error('Cannot compare units with different bases');
    }

    return _compareNatural(ux.value, uy.value);
  },
});

// =============================================================================
// Barrel export
// =============================================================================

/**
 * All typed relational functions.
 */
export const typedRelational = {
  equalScalar,
  unequal,
  deepEqual,
  compareText,
  equalText,
  compareNatural,
  compareUnits,
};
