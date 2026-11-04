/**
 * Modular arithmetic: modular exponentiation, previous prime, Legendre symbol,
 * modular square roots (Tonelli–Shanks) and Carmichael-number test (Korselt).
 */

function toBig(x: bigint | number, name: string): bigint {
  if (typeof x === 'bigint') return x;
  if (!Number.isSafeInteger(x)) throw new RangeError(`${name} must be a safe integer`);
  return BigInt(x);
}

/** Trial-division primality test for safe integers (self-contained). */
function isPrimeNum(n: number): boolean {
  if (!Number.isSafeInteger(n) || n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  for (let d = 3; d * d <= n; d += 2) {
    if (n % d === 0) return false;
  }
  return true;
}

function assertOddPrime(p: number): void {
  if (!isPrimeNum(p) || p === 2) throw new RangeError('p must be an odd prime');
}

function mod(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r < 0n ? r + m : r;
}

/**
 * Modular exponentiation `base^exp mod mod` by right-to-left binary squaring.
 * The result lies in `[0, mod)`.
 */
export function modPow(base: bigint | number, exp: bigint | number, mod_: bigint | number): bigint {
  let b = toBig(base, 'base');
  let e = toBig(exp, 'exp');
  const m = toBig(mod_, 'mod');
  if (m <= 0n) throw new RangeError('mod must be positive');
  if (e < 0n) throw new RangeError('exp must be non-negative');
  if (m === 1n) return 0n;
  b = mod(b, m);
  let result = 1n;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return result;
}

/** Largest prime strictly less than `n`. Throws RangeError when `n <= 2`. */
export function prevPrime(n: number): number {
  if (!Number.isSafeInteger(n) || n <= 2)
    throw new RangeError('prevPrime requires an integer n > 2');
  let c = n - 1;
  while (!isPrimeNum(c)) c--;
  return c;
}

/**
 * Legendre symbol (a/p) for an odd prime p, via Euler's criterion.
 * Returns 0 when p divides a, 1 for a quadratic residue, -1 otherwise.
 */
export function legendreSymbol(a: number, p: number): -1 | 0 | 1 {
  assertOddPrime(p);
  const r = mod(BigInt(a), BigInt(p));
  if (r === 0n) return 0;
  const t = modPow(r, BigInt((p - 1) / 2), p);
  return t === 1n ? 1 : -1;
}

/**
 * Square root of `a` modulo a prime `p` (Tonelli–Shanks). Returns the smallest
 * root in `[0, p)`, or `null` when `a` is a non-residue. For `p = 2` returns `a mod 2`.
 */
export function sqrtMod(a: number, p: number): number | null {
  if (p === 2) return Number(mod(BigInt(a), 2n));
  assertOddPrime(p);
  const P = BigInt(p);
  const n = mod(BigInt(a), P);
  if (n === 0n) return 0;
  if (modPow(n, (P - 1n) / 2n, P) !== 1n) return null;

  // Write p - 1 = q * 2^s with q odd.
  let q = P - 1n;
  let s = 0;
  while ((q & 1n) === 0n) {
    q >>= 1n;
    s++;
  }
  // Find a quadratic non-residue z.
  let z = 2n;
  while (modPow(z, (P - 1n) / 2n, P) !== P - 1n) z++;

  let m = s;
  let c = modPow(z, q, P);
  let t = modPow(n, q, P);
  let r = modPow(n, (q + 1n) / 2n, P);
  while (t !== 1n) {
    // Find least i, 0 < i < m, with t^(2^i) = 1.
    let i = 0;
    let tt = t;
    while (tt !== 1n) {
      tt = (tt * tt) % P;
      i++;
    }
    const b = modPow(c, 1n << BigInt(m - i - 1), P);
    m = i;
    c = (b * b) % P;
    t = (t * c) % P;
    r = (r * b) % P;
  }
  const other = P - r;
  return Number(r < other ? r : other);
}

/** Prime factorization of a positive safe integer as [prime, exponent] pairs. */
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

/**
 * Carmichael test by Korselt's criterion: `n` is composite, squarefree, and
 * `(p - 1)` divides `(n - 1)` for every prime factor `p` of `n`.
 */
export function isCarmichael(n: number): boolean {
  if (!Number.isSafeInteger(n) || n < 2) return false;
  if (isPrimeNum(n)) return false;
  const factors = factorize(n);
  if (factors.some(([, e]) => e > 1)) return false;
  return factors.every(([p]) => (n - 1) % (p - 1) === 0);
}
