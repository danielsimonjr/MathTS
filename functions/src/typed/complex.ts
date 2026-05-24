/**
 * Typed Complex Helper Functions
 *
 * Polymorphic complex-number utilities using typed-function for runtime dispatch.
 * Supports `number`, `bigint`, `BigNumber`, `Complex`, and `Array` types.
 *
 * Semantics follow the mathjs convention:
 *   - `arg(number)` → `Math.atan2(0, number)` — 0 for positive, π for negative, 0 for 0, NaN for NaN.
 *   - `conj(real)` → identity (real numbers are self-conjugate).
 *   - `im(real)`   → 0 (real numbers have no imaginary part).
 *   - `re(real)`   → the number itself.
 *
 * @packageDocumentation
 */

import { mathTyped, Complex, BigNumber } from '@danielsimonjr/mathts-core';

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Recursively map a function over a nested array (deepMap equivalent).
 * Returns a new array of the same shape.
 */
function deepMapArray<T>(arr: unknown[], fn: (x: unknown) => T): T[] {
  return arr.map((item) =>
    Array.isArray(item) ? (deepMapArray(item, fn) as unknown as T) : fn(item)
  );
}

// =============================================================================
// arg — argument (phase angle) of a complex number
// =============================================================================

/**
 * Compute the argument (phase angle in radians) of a complex number or real value.
 *
 * For a complex number `a + bi`, the argument is `atan2(b, a)`.
 * For a real number `x`, the result is `atan2(0, x)`:
 *   - `x > 0` → 0
 *   - `x < 0` → π
 *   - `x = 0` → 0 (mathjs convention, not -π)
 *   - `x = NaN` → NaN
 *
 * For arrays, the function is applied element-wise.
 *
 * @example
 * ```typescript
 * arg(1)                      // 0
 * arg(-1)                     // Math.PI
 * arg(new Complex(1, 1))      // Math.PI / 4
 * arg([1, -1, new Complex(0, 1)])  // [0, Math.PI, Math.PI / 2]
 * ```
 */
export const arg = mathTyped('arg', {
  number: (x: number): number => Math.atan2(0, x),

  bigint: (x: bigint): number => {
    // A bigint is always a real integer. atan2(0, positive) = 0, atan2(0, negative) = π.
    if (x > 0n) return 0;
    if (x < 0n) return Math.PI;
    return 0; // x === 0n
  },

  BigNumber: (x: BigNumber): number => {
    if (x.isNaN()) return NaN;
    if (x.isZero()) return 0;
    if (x.isNegative()) return Math.PI;
    return 0;
  },

  Complex: (x: Complex): number => x.arg(),

  Array: (x: unknown[]): unknown[] => deepMapArray(x, (item) => arg(item as number)),
});

// =============================================================================
// conj — complex conjugate
// =============================================================================

/**
 * Compute the complex conjugate of a value.
 * For a complex number `a + bi`, the conjugate is `a - bi`.
 * For real numbers (number, bigint, BigNumber), the value is returned as-is
 * (real numbers are self-conjugate).
 *
 * For arrays, the function is applied element-wise.
 *
 * @example
 * ```typescript
 * conj(5)                        // 5
 * conj(new Complex(3, 4))        // Complex(3, -4)
 * conj([new Complex(1, 2), 3])   // [Complex(1, -2), 3]
 * ```
 */
export const conj = mathTyped('conj', {
  number: (x: number): number => x,

  bigint: (x: bigint): bigint => x,

  BigNumber: (x: BigNumber): BigNumber => x,

  Complex: (x: Complex): Complex => x.conjugate(),

  Array: (x: unknown[]): unknown[] => deepMapArray(x, (item) => conj(item as number)),
});

// =============================================================================
// im — imaginary part
// =============================================================================

/**
 * Get the imaginary part of a complex number.
 * For a complex number `a + bi`, the function returns `b`.
 * For real numbers (number, bigint, BigNumber), returns 0.
 *
 * For arrays, the function is applied element-wise.
 *
 * @example
 * ```typescript
 * im(new Complex(3, 4))   // 4
 * im(5)                   // 0
 * im([new Complex(1, 2), 3])  // [2, 0]
 * ```
 */
export const im = mathTyped('im', {
  number: (_x: number): number => 0,

  bigint: (_x: bigint): number => 0,

  BigNumber: (_x: BigNumber): BigNumber => BigNumber.fromNumber(0),

  Complex: (x: Complex): number => x.im,

  Array: (x: unknown[]): unknown[] => deepMapArray(x, (item) => im(item as number)),
});

// =============================================================================
// re — real part
// =============================================================================

/**
 * Get the real part of a complex number.
 * For a complex number `a + bi`, the function returns `a`.
 * For real numbers (number, bigint, BigNumber), returns the value itself.
 *
 * For arrays, the function is applied element-wise.
 *
 * @example
 * ```typescript
 * re(new Complex(3, 4))   // 3
 * re(5)                   // 5
 * re([new Complex(1, 2), 3])  // [1, 3]
 * ```
 */
export const re = mathTyped('re', {
  number: (x: number): number => x,

  bigint: (x: bigint): bigint => x,

  BigNumber: (x: BigNumber): BigNumber => x,

  Complex: (x: Complex): number => x.re,

  Array: (x: unknown[]): unknown[] => deepMapArray(x, (item) => re(item as number)),
});

// =============================================================================
// Barrel export
// =============================================================================

/**
 * All typed complex helper functions.
 */
export const typedComplex = {
  arg,
  conj,
  im,
  re,
};
