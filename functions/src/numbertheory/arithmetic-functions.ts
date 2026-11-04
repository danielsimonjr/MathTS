/**
 * Arithmetic functions and integer power / root helpers: squarefree tests,
 * radical, Omega counts, Liouville, von Mangoldt, Mertens, perfect and
 * prime-power tests, exact integer roots, digit sums, Collatz and primorial.
 */

function assertPositiveInt(n: number, name: string): void {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`${name} must be a positive integer`);
}

/** Prime factorization of a positive integer as [prime, exponent] pairs. */
function factorize(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let m = n;
  for (let d = 2; d * d <= m; d++) {
    if (m % d === 0) {
      let e = 0;
      while (m % d === 0) {
        m /= d;
        e++;
      }
      out.push([d, e]);
    }
  }
  if (m > 1) out.push([m, 1]);
  return out;
}

function mobius(n: number): -1 | 0 | 1 {
  let sign: -1 | 1 = 1;
  for (const [, e] of factorize(n)) {
    if (e > 1) return 0;
    sign = sign === 1 ? -1 : 1;
  }
  return sign === 1 ? 1 : -1;
}

/** Sum of the divisors of n (sigma), computed from the factorization. */
function sigma(n: number): number {
  let total = 1;
  for (const [p, e] of factorize(n)) {
    let term = 1;
    let pk = 1;
    for (let i = 0; i < e; i++) {
      pk *= p;
      term += pk;
    }
    total *= term;
  }
  return total;
}

/** True when n is a positive integer with no square factor greater than 1. */
export function isSquarefree(n: number): boolean {
  assertPositiveInt(n, 'n');
  return factorize(n).every(([, e]) => e === 1);
}

/** Product of the distinct prime factors of n (rad(n)). */
export function radical(n: number): number {
  assertPositiveInt(n, 'n');
  return factorize(n).reduce((acc, [p]) => acc * p, 1);
}

/** Number of prime factors counted with multiplicity (Omega). */
export function bigOmega(n: number): number {
  assertPositiveInt(n, 'n');
  return factorize(n).reduce((acc, [, e]) => acc + e, 0);
}

/** Number of distinct prime factors (omega). */
export function smallOmega(n: number): number {
  assertPositiveInt(n, 'n');
  return factorize(n).length;
}

/** Liouville function lambda(n) = (-1)^Omega(n). */
export function liouvilleLambda(n: number): -1 | 1 {
  return bigOmega(n) % 2 === 0 ? 1 : -1;
}

/** von Mangoldt function: ln p when n = p^k (k >= 1), otherwise 0. */
export function vonMangoldt(n: number): number {
  assertPositiveInt(n, 'n');
  const f = factorize(n);
  return f.length === 1 ? Math.log(f[0][0]) : 0;
}

/** Mertens function M(n) = sum of mu(k) for k = 1..n. */
export function mertens(n: number): number {
  assertPositiveInt(n, 'n');
  let total = 0;
  for (let k = 1; k <= n; k++) total += mobius(k);
  return total;
}

/** True when n equals the sum of its proper divisors (n >= 2). */
export function isPerfect(n: number): boolean {
  assertPositiveInt(n, 'n');
  return n >= 2 && sigma(n) - n === n;
}

/** Floor of the square root of a non-negative bigint (Newton iteration). */
export function integerSqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError('integerSqrt requires a non-negative argument');
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  // Correct the float estimate, then refine with Newton steps.
  while (x * x > n) x--;
  while ((x + 1n) * (x + 1n) <= n) x++;
  return x;
}

/** Floor of the k-th root of a non-negative bigint (binary search). */
export function integerNthRoot(n: bigint, k: number): bigint {
  if (n < 0n) throw new RangeError('integerNthRoot requires a non-negative argument');
  if (!Number.isSafeInteger(k) || k < 1) throw new RangeError('k must be a positive integer');
  if (n < 2n || k === 1) return n;
  const bits = n.toString(2).length;
  let lo = 0n;
  let hi = 1n << BigInt(Math.ceil(bits / k) + 1);
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    if (mid ** BigInt(k) <= n) lo = mid;
    else hi = mid - 1n;
  }
  return lo;
}

/**
 * Perfect-power test. Returns `{ base, exp }` with `n = base^exp`, `base > 1`,
 * and `exp` as large as possible; `null` if n is not a perfect power (or n < 2).
 */
export function isPerfectPower(n: number): { base: number; exp: number } | null {
  if (!Number.isSafeInteger(n) || n < 2) return null;
  const big = BigInt(n);
  const maxExp = Math.floor(Math.log2(n));
  for (let k = maxExp; k >= 2; k--) {
    const r = integerNthRoot(big, k);
    if (r > 1n && r ** BigInt(k) === big) return { base: Number(r), exp: k };
  }
  return null;
}

/**
 * Prime-power test: `{ p, k }` with `n = p^k`, `k >= 1`; `null` if n is not a
 * prime power (or n < 2).
 */
export function isPrimePower(n: number): { p: number; k: number } | null {
  if (!Number.isSafeInteger(n) || n < 2) return null;
  const f = factorize(n);
  return f.length === 1 ? { p: f[0][0], k: f[0][1] } : null;
}

/** Sum of the digits of n in the given base (default 10). */
export function digitSum(n: number | bigint, base = 10): number {
  if (!Number.isInteger(base) || base < 2) throw new RangeError('base must be an integer >= 2');
  let m = typeof n === 'bigint' ? n : BigInt(n);
  if (m < 0n) throw new RangeError('digitSum requires a non-negative integer');
  const b = BigInt(base);
  let total = 0n;
  while (m > 0n) {
    total += m % b;
    m /= b;
  }
  return Number(total);
}

/** Digital root (repeated digit sum until a single digit), base 10. */
export function digitalRoot(n: number): number {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError('digitalRoot requires a non-negative integer');
  if (n === 0) return 0;
  return 1 + ((n - 1) % 9);
}

/** Number of steps for the Collatz (3n+1) sequence to reach 1. */
export function collatzSteps(n: number): number {
  assertPositiveInt(n, 'n');
  let m = n;
  let steps = 0;
  while (m !== 1) {
    m = m % 2 === 0 ? m / 2 : 3 * m + 1;
    steps++;
  }
  return steps;
}

/** Primorial n# = product of all primes <= n (n >= 0). */
export function primorial(n: number): bigint {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError('primorial requires a non-negative integer');
  let result = 1n;
  for (let k = 2; k <= n; k++) {
    let prime = true;
    for (let d = 2; d * d <= k; d++) {
      if (k % d === 0) {
        prime = false;
        break;
      }
    }
    if (prime) result *= BigInt(k);
  }
  return result;
}
