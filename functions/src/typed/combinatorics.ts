/**
 * Extended Combinatorics Functions
 *
 * Provides combinatorial number sequences and factorial variants:
 * - fibonacci: nth Fibonacci number (fast doubling, O(log n))
 * - lucas: nth Lucas number
 * - doubleFactorial: n!! = n * (n-2) * (n-4) * ...
 * - risingFactorial: Pochhammer symbol x^(n) = x(x+1)...(x+n-1)
 * - fallingFactorial: x_(n) = x(x-1)...(x-n+1)
 * - subfactorial: !n = number of derangements
 *
 * Uses mathTyped for type dispatch on numeric arguments.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';

// =============================================================================
// fibonacci - Fibonacci Number (Fast Doubling)
// =============================================================================

/**
 * Compute the nth Fibonacci number using the fast doubling method.
 *
 * Fast doubling uses the identities:
 *   F(2k) = F(k) * [2*F(k+1) - F(k)]
 *   F(2k+1) = F(k)^2 + F(k+1)^2
 *
 * Time complexity: O(log n)
 *
 * @param n - Non-negative integer index
 * @returns The nth Fibonacci number
 *
 * @example
 * fibonacci(0)  // => 0
 * fibonacci(1)  // => 1
 * fibonacci(10) // => 55
 * fibonacci(20) // => 6765
 */
export const fibonacci = mathTyped('fibonacci', {
  number: (n: number): number => {
    if (n < 0 || !Number.isInteger(n)) {
      throw new Error('fibonacci requires a non-negative integer');
    }
    if (n === 0) return 0;
    if (n === 1) return 1;

    // Fast doubling
    let a = 0; // F(k)
    let b = 1; // F(k+1)

    // Find highest bit position
    let bits = 0;
    let temp = n;
    while (temp > 0) {
      bits++;
      temp >>>= 1;
    }

    for (let i = bits - 1; i >= 0; i--) {
      // Doubling step: compute F(2k) and F(2k+1)
      const c = a * (2 * b - a);
      const d = a * a + b * b;

      if ((n >>> i) & 1) {
        // Bit is 1: k = 2k + 1
        a = d;
        b = c + d;
      } else {
        // Bit is 0: k = 2k
        a = c;
        b = d;
      }
    }

    return a;
  },
});

// =============================================================================
// lucas - Lucas Number
// =============================================================================

/**
 * Compute the nth Lucas number.
 *
 * Lucas numbers follow the same recurrence as Fibonacci but with
 * L(0) = 2, L(1) = 1. Related to Fibonacci by L(n) = F(n-1) + F(n+1).
 *
 * Uses the fast doubling identities:
 *   L(2k) = L(k)^2 - 2*(-1)^k
 *   L(2k+1) = L(k)*L(k+1) - (-1)^k * ... (via Fibonacci relation)
 *
 * @param n - Non-negative integer index
 * @returns The nth Lucas number
 *
 * @example
 * lucas(0)  // => 2
 * lucas(1)  // => 1
 * lucas(10) // => 123
 */
export const lucas = mathTyped('lucas', {
  number: (n: number): number => {
    if (n < 0 || !Number.isInteger(n)) {
      throw new Error('lucas requires a non-negative integer');
    }
    if (n === 0) return 2;
    if (n === 1) return 1;

    // Use relation L(n) = F(n-1) + F(n+1)
    // Compute F(n-1) and F(n) via fast doubling, then L(n) = F(n-1) + F(n+1)
    // F(n+1) = F(n) + F(n-1), so L(n) = 2*F(n-1) + F(n)
    let a = 0; // F(k)
    let b = 1; // F(k+1)

    let bits = 0;
    let temp = n;
    while (temp > 0) {
      bits++;
      temp >>>= 1;
    }

    for (let i = bits - 1; i >= 0; i--) {
      const c = a * (2 * b - a);
      const d = a * a + b * b;

      if ((n >>> i) & 1) {
        a = d;
        b = c + d;
      } else {
        a = c;
        b = d;
      }
    }

    // a = F(n), b = F(n+1)
    // F(n-1) = F(n+1) - F(n) = b - a
    // L(n) = F(n-1) + F(n+1) = (b - a) + b = 2*b - a
    return 2 * b - a;
  },
});

// =============================================================================
// doubleFactorial - n!!
// =============================================================================

/**
 * Compute the double factorial n!!.
 *
 * n!! = n * (n-2) * (n-4) * ... * (2 or 1)
 *
 * For odd n:  n!! = n * (n-2) * ... * 3 * 1
 * For even n: n!! = n * (n-2) * ... * 4 * 2
 *
 * Special cases: 0!! = 1, (-1)!! = 1
 *
 * @param n - Non-negative integer (or -1)
 * @returns The double factorial
 *
 * @example
 * doubleFactorial(7) // => 105 (7*5*3*1)
 * doubleFactorial(6) // => 48 (6*4*2)
 * doubleFactorial(0) // => 1
 */
export const doubleFactorial = mathTyped('doubleFactorial', {
  number: (n: number): number => {
    if (!Number.isInteger(n) || n < -1) {
      throw new Error('doubleFactorial requires an integer >= -1');
    }
    if (n <= 0) return 1;

    let result = 1;
    for (let k = n; k >= 2; k -= 2) {
      result *= k;
    }
    return result;
  },
});

// =============================================================================
// risingFactorial - Pochhammer Symbol
// =============================================================================

/**
 * Compute the rising factorial (Pochhammer symbol).
 *
 * x^(n) = x * (x+1) * (x+2) * ... * (x+n-1)
 *
 * Also written as (x)_n in some notations.
 * Rising factorial of 0 terms is 1 by convention.
 *
 * @param x - Base value
 * @param n - Number of terms (non-negative integer)
 * @returns The rising factorial
 *
 * @example
 * risingFactorial(3, 4) // => 3*4*5*6 = 360
 * risingFactorial(1, 5) // => 1*2*3*4*5 = 120 = 5!
 */
export const risingFactorial = mathTyped('risingFactorial', {
  'number, number': (x: number, n: number): number => {
    if (!Number.isInteger(n) || n < 0) {
      throw new Error('risingFactorial requires a non-negative integer for n');
    }
    if (n === 0) return 1;

    let result = 1;
    for (let i = 0; i < n; i++) {
      result *= x + i;
    }
    return result;
  },
});

// =============================================================================
// fallingFactorial
// =============================================================================

/**
 * Compute the falling factorial.
 *
 * x_(n) = x * (x-1) * (x-2) * ... * (x-n+1)
 *
 * Falling factorial of 0 terms is 1 by convention.
 *
 * @param x - Base value
 * @param n - Number of terms (non-negative integer)
 * @returns The falling factorial
 *
 * @example
 * fallingFactorial(5, 3) // => 5*4*3 = 60
 * fallingFactorial(5, 5) // => 5*4*3*2*1 = 120 = 5!
 */
export const fallingFactorial = mathTyped('fallingFactorial', {
  'number, number': (x: number, n: number): number => {
    if (!Number.isInteger(n) || n < 0) {
      throw new Error('fallingFactorial requires a non-negative integer for n');
    }
    if (n === 0) return 1;

    let result = 1;
    for (let i = 0; i < n; i++) {
      result *= x - i;
    }
    return result;
  },
});

// =============================================================================
// subfactorial - Derangements
// =============================================================================

/**
 * Compute the subfactorial (number of derangements).
 *
 * !n = n! * sum_{k=0}^{n} (-1)^k / k!
 *
 * A derangement is a permutation where no element appears in its original position.
 *
 * @param n - Non-negative integer
 * @returns The number of derangements of n elements
 *
 * @example
 * subfactorial(0) // => 1
 * subfactorial(1) // => 0
 * subfactorial(2) // => 1
 * subfactorial(5) // => 44
 */
export const subfactorial = mathTyped('subfactorial', {
  number: (n: number): number => {
    if (n < 0 || !Number.isInteger(n)) {
      throw new Error('subfactorial requires a non-negative integer');
    }
    if (n === 0) return 1;
    if (n === 1) return 0;

    // Use recurrence: !n = (n-1) * (!(n-1) + !(n-2))
    let prev2 = 1; // !(0)
    let prev1 = 0; // !(1)

    for (let k = 2; k <= n; k++) {
      const current = (k - 1) * (prev1 + prev2);
      prev2 = prev1;
      prev1 = current;
    }

    return prev1;
  },
});
