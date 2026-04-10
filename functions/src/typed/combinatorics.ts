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

// =============================================================================
// Number Theory & Extended Combinatorics
// =============================================================================

// =============================================================================
// prime - nth Prime Number
// =============================================================================

/**
 * Return the nth prime number (1-indexed).
 *
 * Uses a sieve-based approach. For n <= 6, returns from lookup.
 * For larger n, estimates an upper bound and sieves.
 *
 * @param n - Positive integer index (1-indexed)
 * @returns The nth prime number
 *
 * @example
 * prime(1)  // => 2
 * prime(4)  // => 7
 * prime(10) // => 29
 */
export const prime = mathTyped('prime', {
  number: (n: number): number => {
    if (n < 1 || !Number.isInteger(n)) {
      throw new Error('prime requires a positive integer');
    }
    const small = [2, 3, 5, 7, 11, 13];
    if (n <= small.length) return small[n - 1];

    // Upper bound for nth prime: p_n < n * (ln(n) + ln(ln(n))) for n >= 6
    const lnN = Math.log(n);
    const limit = Math.ceil(n * (lnN + Math.log(lnN)) * 1.3);
    const sieve = _sieveOfEratosthenes(limit);
    if (n > sieve.length) {
      throw new Error('prime: sieve too small (internal error)');
    }
    return sieve[n - 1];
  },
});

/**
 * Sieve of Eratosthenes returning all primes up to limit.
 */
function _sieveOfEratosthenes(limit: number): number[] {
  const isComposite = new Uint8Array(limit + 1);
  const primes: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (!isComposite[i]) {
      primes.push(i);
      if (i * i <= limit) {
        for (let j = i * i; j <= limit; j += i) {
          isComposite[j] = 1;
        }
      }
    }
  }
  return primes;
}

// =============================================================================
// nextPrime - Smallest prime > n
// =============================================================================

/**
 * Return the smallest prime number strictly greater than n.
 *
 * @param n - Non-negative number
 * @returns Smallest prime > n
 *
 * @example
 * nextPrime(4)  // => 5
 * nextPrime(7)  // => 11
 * nextPrime(10) // => 11
 */
export const nextPrime = mathTyped('nextPrime', {
  number: (n: number): number => {
    if (n < 0) throw new Error('nextPrime requires a non-negative number');
    let candidate = Math.floor(n) + 1;
    if (candidate <= 2) return 2;
    if (candidate % 2 === 0) candidate++;
    while (!_isPrime(candidate)) {
      candidate += 2;
    }
    return candidate;
  },
});

/**
 * Primality test using trial division (sufficient for JS safe integer range).
 */
function _isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

// =============================================================================
// primePi - Prime Counting Function
// =============================================================================

/**
 * Prime counting function pi(n): number of primes <= n.
 *
 * @param n - Non-negative integer
 * @returns Number of primes not exceeding n
 *
 * @example
 * primePi(10) // => 4 (primes: 2, 3, 5, 7)
 * primePi(1)  // => 0
 */
export const primePi = mathTyped('primePi', {
  number: (n: number): number => {
    if (n < 2) return 0;
    const limit = Math.floor(n);
    const sieve = _sieveOfEratosthenes(limit);
    return sieve.length;
  },
});

// =============================================================================
// primeFactors - Prime Factorization
// =============================================================================

/**
 * Return the prime factorization of n as an array of prime factors
 * (with repetition, sorted ascending).
 *
 * @param n - Positive integer >= 2
 * @returns Array of prime factors
 *
 * @example
 * primeFactors(12)  // => [2, 2, 3]
 * primeFactors(60)  // => [2, 2, 3, 5]
 * primeFactors(7)   // => [7]
 */
export const primeFactors = mathTyped('primeFactors', {
  number: (n: number): number[] => {
    if (n < 2 || !Number.isInteger(n)) {
      throw new Error('primeFactors requires an integer >= 2');
    }
    const factors: number[] = [];
    let m = n;
    for (let d = 2; d * d <= m; d++) {
      while (m % d === 0) {
        factors.push(d);
        m /= d;
      }
    }
    if (m > 1) factors.push(m);
    return factors;
  },
});

// =============================================================================
// divisors - List All Divisors
// =============================================================================

/**
 * Return all positive divisors of n, sorted ascending.
 *
 * @param n - Positive integer
 * @returns Sorted array of divisors
 *
 * @example
 * divisors(12) // => [1, 2, 3, 4, 6, 12]
 * divisors(7)  // => [1, 7]
 */
export const divisors = mathTyped('divisors', {
  number: (n: number): number[] => {
    if (n < 1 || !Number.isInteger(n)) {
      throw new Error('divisors requires a positive integer');
    }
    const small: number[] = [];
    const large: number[] = [];
    for (let i = 1; i * i <= n; i++) {
      if (n % i === 0) {
        small.push(i);
        if (i !== n / i) large.push(n / i);
      }
    }
    return small.concat(large.reverse());
  },
});

// =============================================================================
// eulerPhi - Euler's Totient Function
// =============================================================================

/**
 * Euler's totient function phi(n): count of integers 1..n coprime to n.
 *
 * @param n - Positive integer
 * @returns phi(n)
 *
 * @example
 * eulerPhi(1)  // => 1
 * eulerPhi(10) // => 4 (1, 3, 7, 9)
 * eulerPhi(12) // => 4 (1, 5, 7, 11)
 */
export const eulerPhi = mathTyped('eulerPhi', {
  number: (n: number): number => {
    if (n < 1 || !Number.isInteger(n)) {
      throw new Error('eulerPhi requires a positive integer');
    }
    let result = n;
    let m = n;
    for (let p = 2; p * p <= m; p++) {
      if (m % p === 0) {
        while (m % p === 0) m /= p;
        result -= result / p;
      }
    }
    if (m > 1) result -= result / m;
    return result;
  },
});

// =============================================================================
// divisorSigma - Sum of Powers of Divisors
// =============================================================================

/**
 * Sum of the kth powers of divisors of n: sigma_k(n).
 *
 * sigma_0(n) = number of divisors
 * sigma_1(n) = sum of divisors
 *
 * @param n - Positive integer
 * @param k - Power (non-negative integer, default 1)
 * @returns sigma_k(n)
 *
 * @example
 * divisorSigma(12)     // => 28 (1+2+3+4+6+12)
 * divisorSigma(12, 0)  // => 6 (number of divisors)
 * divisorSigma(12, 2)  // => 210
 */
export const divisorSigma = mathTyped('divisorSigma', {
  number: (n: number): number => {
    return _divisorSigmaImpl(n, 1);
  },
  'number, number': (n: number, k: number): number => {
    return _divisorSigmaImpl(n, k);
  },
});

function _divisorSigmaImpl(n: number, k: number): number {
  if (n < 1 || !Number.isInteger(n)) {
    throw new Error('divisorSigma requires a positive integer');
  }
  if (k < 0 || !Number.isInteger(k)) {
    throw new Error('divisorSigma: k must be a non-negative integer');
  }
  let sum = 0;
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      sum += Math.pow(i, k);
      if (i !== n / i) sum += Math.pow(n / i, k);
    }
  }
  return sum;
}

// =============================================================================
// carmichaelLambda - Carmichael Function
// =============================================================================

/**
 * Carmichael function lambda(n): smallest positive integer m such that
 * a^m === 1 (mod n) for all a coprime to n.
 *
 * @param n - Positive integer
 * @returns lambda(n)
 *
 * @example
 * carmichaelLambda(1)  // => 1
 * carmichaelLambda(8)  // => 2
 * carmichaelLambda(15) // => 4
 */
export const carmichaelLambda = mathTyped('carmichaelLambda', {
  number: (n: number): number => {
    if (n < 1 || !Number.isInteger(n)) {
      throw new Error('carmichaelLambda requires a positive integer');
    }
    if (n === 1) return 1;

    // Factor n into prime powers, compute lambda for each, take LCM
    let m = n;
    let result = 1;
    for (let p = 2; p * p <= m; p++) {
      if (m % p === 0) {
        let pk = 1;
        while (m % p === 0) {
          pk *= p;
          m /= p;
        }
        let lam = _carmichaelPrimePower(p, pk);
        result = _lcm(result, lam);
      }
    }
    if (m > 1) {
      result = _lcm(result, m - 1);
    }
    return result;
  },
});

function _carmichaelPrimePower(p: number, pk: number): number {
  if (p === 2) {
    if (pk <= 2) return 1;
    if (pk === 4) return 2;
    // For 2^a with a >= 3: lambda = 2^(a-2)
    return pk / 4;
  }
  // For odd prime p^a: lambda = p^(a-1) * (p-1) = phi(p^a)
  return (pk / p) * (p - 1);
}

function _gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

function _lcm(a: number, b: number): number {
  return (a / _gcd(a, b)) * b;
}

// =============================================================================
// moebiusMu - Mobius Function
// =============================================================================

/**
 * Mobius function mu(n).
 *
 * mu(1) = 1
 * mu(n) = 0 if n has a squared prime factor
 * mu(n) = (-1)^k if n is a product of k distinct primes
 *
 * @param n - Positive integer
 * @returns mu(n): -1, 0, or 1
 *
 * @example
 * moebiusMu(1)  // => 1
 * moebiusMu(6)  // => 1 (6 = 2*3, two distinct primes)
 * moebiusMu(4)  // => 0 (4 = 2^2, squared factor)
 * moebiusMu(30) // => -1 (30 = 2*3*5, three distinct primes)
 */
export const moebiusMu = mathTyped('moebiusMu', {
  number: (n: number): number => {
    if (n < 1 || !Number.isInteger(n)) {
      throw new Error('moebiusMu requires a positive integer');
    }
    if (n === 1) return 1;

    let m = n;
    let numFactors = 0;
    for (let p = 2; p * p <= m; p++) {
      if (m % p === 0) {
        m /= p;
        if (m % p === 0) return 0; // squared factor
        numFactors++;
      }
    }
    if (m > 1) numFactors++;
    return numFactors % 2 === 0 ? 1 : -1;
  },
});

// =============================================================================
// jacobiSymbol - Jacobi Symbol (a/n)
// =============================================================================

/**
 * Jacobi symbol (a/n), a generalization of the Legendre symbol.
 *
 * n must be a positive odd integer.
 *
 * @param a - Integer
 * @param n - Positive odd integer
 * @returns -1, 0, or 1
 *
 * @example
 * jacobiSymbol(2, 7)  // => 1
 * jacobiSymbol(5, 21) // => 1
 * jacobiSymbol(7, 15) // => -1
 */
export const jacobiSymbol = mathTyped('jacobiSymbol', {
  'number, number': (a: number, n: number): number => {
    if (n < 1 || !Number.isInteger(n) || n % 2 === 0) {
      throw new Error('jacobiSymbol: n must be a positive odd integer');
    }
    if (!Number.isInteger(a)) {
      throw new Error('jacobiSymbol: a must be an integer');
    }
    if (n === 1) return 1;

    a = ((a % n) + n) % n;
    let result = 1;
    let aa = a;
    let nn = n;

    while (aa !== 0) {
      while (aa % 2 === 0) {
        aa /= 2;
        if (nn % 8 === 3 || nn % 8 === 5) result = -result;
      }
      [aa, nn] = [nn, aa];
      if (aa % 4 === 3 && nn % 4 === 3) result = -result;
      aa = aa % nn;
    }
    return nn === 1 ? result : 0;
  },
});

// =============================================================================
// chineseRemainder - Chinese Remainder Theorem
// =============================================================================

/**
 * Solve a system of simultaneous congruences using the Chinese Remainder Theorem.
 *
 * Find x such that x === remainders[i] (mod moduli[i]) for all i.
 * Moduli must be pairwise coprime.
 *
 * @param remainders - Array of remainders
 * @param moduli - Array of moduli (pairwise coprime)
 * @returns Solution x (smallest non-negative)
 *
 * @example
 * chineseRemainder([2, 3, 2], [3, 5, 7]) // => 23
 * // x === 2 (mod 3), x === 3 (mod 5), x === 2 (mod 7)
 */
export const chineseRemainder = mathTyped('chineseRemainder', {
  'Array, Array': (remainders: number[], moduli: number[]): number => {
    if (remainders.length !== moduli.length) {
      throw new Error('chineseRemainder: remainders and moduli must have same length');
    }
    if (remainders.length === 0) {
      throw new Error('chineseRemainder: arrays must be non-empty');
    }

    const n = remainders.length;
    let M = 1;
    for (let i = 0; i < n; i++) {
      if (moduli[i] < 1 || !Number.isInteger(moduli[i])) {
        throw new Error('chineseRemainder: moduli must be positive integers');
      }
      M *= moduli[i];
    }

    let x = 0;
    for (let i = 0; i < n; i++) {
      const Mi = M / moduli[i];
      const yi = _modInverse(Mi, moduli[i]);
      if (yi === -1) {
        throw new Error('chineseRemainder: moduli must be pairwise coprime');
      }
      x += remainders[i] * Mi * yi;
    }
    return ((x % M) + M) % M;
  },
});

/**
 * Modular multiplicative inverse of a mod m using extended Euclidean algorithm.
 * Returns -1 if inverse doesn't exist.
 */
function _modInverse(a: number, m: number): number {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1, 0];

  while (r !== 0) {
    const q = Math.floor(old_r / r);
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }

  if (old_r !== 1) return -1;
  return ((old_s % m) + m) % m;
}

// =============================================================================
// lucasL - Lucas Number (standalone, not via Fibonacci relation)
// =============================================================================

/**
 * Compute the nth Lucas number L(n).
 *
 * This is a standalone implementation using iterative computation.
 * L(0) = 2, L(1) = 1, L(n) = L(n-1) + L(n-2).
 *
 * Note: the `lucas` export above uses a Fibonacci-based approach.
 * This provides a direct iterative alternative.
 *
 * @param n - Non-negative integer
 * @returns L(n)
 *
 * @example
 * lucasL(0)  // => 2
 * lucasL(5)  // => 11
 * lucasL(10) // => 123
 */
export const lucasL = mathTyped('lucasL', {
  number: (n: number): number => {
    if (n < 0 || !Number.isInteger(n)) {
      throw new Error('lucasL requires a non-negative integer');
    }
    if (n === 0) return 2;
    if (n === 1) return 1;
    let a = 2;
    let b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  },
});

// =============================================================================
// partitions - Integer Partition Count
// =============================================================================

/**
 * Number of integer partitions of n.
 *
 * A partition of n is a way to write n as a sum of positive integers
 * (order doesn't matter).
 *
 * Uses dynamic programming.
 *
 * @param n - Non-negative integer
 * @returns p(n)
 *
 * @example
 * partitions(0) // => 1
 * partitions(4) // => 5 (4, 3+1, 2+2, 2+1+1, 1+1+1+1)
 * partitions(5) // => 7
 */
export const partitions = mathTyped('partitions', {
  number: (n: number): number => {
    if (n < 0 || !Number.isInteger(n)) {
      throw new Error('partitions requires a non-negative integer');
    }
    // dp[i] = number of partitions of i
    const dp = new Array(n + 1).fill(0);
    dp[0] = 1;
    for (let k = 1; k <= n; k++) {
      for (let i = k; i <= n; i++) {
        dp[i] += dp[i - k];
      }
    }
    return dp[n];
  },
});

// =============================================================================
// harmonicNumber - nth Harmonic Number
// =============================================================================

/**
 * Compute the nth harmonic number H(n) = 1 + 1/2 + 1/3 + ... + 1/n.
 *
 * @param n - Positive integer
 * @returns H(n)
 *
 * @example
 * harmonicNumber(1) // => 1
 * harmonicNumber(4) // => 2.0833... (1 + 1/2 + 1/3 + 1/4)
 */
export const harmonicNumber = mathTyped('harmonicNumber', {
  number: (n: number): number => {
    if (n < 1 || !Number.isInteger(n)) {
      throw new Error('harmonicNumber requires a positive integer');
    }
    let sum = 0;
    for (let i = 1; i <= n; i++) {
      sum += 1 / i;
    }
    return sum;
  },
});

// =============================================================================
// integerDigits - Digits of n in given base
// =============================================================================

/**
 * Return the digits of n in the given base as an array (most significant first).
 *
 * @param n - Non-negative integer
 * @param base - Base (integer >= 2, default 10)
 * @returns Array of digits
 *
 * @example
 * integerDigits(123)     // => [1, 2, 3]
 * integerDigits(255, 16) // => [15, 15]
 * integerDigits(10, 2)   // => [1, 0, 1, 0]
 * integerDigits(0)       // => [0]
 */
export const integerDigits = mathTyped('integerDigits', {
  number: (n: number): number[] => {
    return _integerDigitsImpl(n, 10);
  },
  'number, number': (n: number, base: number): number[] => {
    return _integerDigitsImpl(n, base);
  },
});

function _integerDigitsImpl(n: number, base: number): number[] {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error('integerDigits requires a non-negative integer');
  }
  if (base < 2 || !Number.isInteger(base)) {
    throw new Error('integerDigits: base must be an integer >= 2');
  }
  if (n === 0) return [0];
  const digits: number[] = [];
  let m = n;
  while (m > 0) {
    digits.push(m % base);
    m = Math.floor(m / base);
  }
  return digits.reverse();
}
