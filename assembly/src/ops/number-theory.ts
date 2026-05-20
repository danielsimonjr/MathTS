/**
 * Number-theory functions — AssemblyScript fallback mirroring
 * `wasm-rust/.../combinatorics/number_theory.rs`.
 *
 * Array-valued functions return a `Float64Array` (AssemblyScript manages the
 * memory); `chineseRemainder` takes two `Float64Array`s.
 */

const MAX_SAFE_INT: f64 = 9.007199254740992e15; // 2^53

function isInt(x: f64): bool {
  return x >= -MAX_SAFE_INT && x <= MAX_SAFE_INT && Math.floor(x) == x;
}

function gcdU(a: i64, b: i64): i64 {
  while (b != 0) {
    const t: i64 = b;
    b = a % b;
    a = t;
  }
  return a;
}

function lcmU(a: i64, b: i64): i64 {
  if (a == 0 || b == 0) return 0;
  return (a / gcdU(a, b)) * b;
}

/** Euler's totient phi(n). */
export function eulerPhi(n: f64): f64 {
  if (!isInt(n) || n < 1.0) return NaN;
  let result: i64 = <i64>n;
  let m: i64 = <i64>n;
  for (let p: i64 = 2; p * p <= m; p++) {
    if (m % p == 0) {
      while (m % p == 0) m /= p;
      result -= result / p;
    }
  }
  if (m > 1) result -= result / m;
  return <f64>result;
}

/** Sum of k-th powers of divisors, sigma_k(n). divisorSigma(n,0) = count. */
export function divisorSigma(n: f64, k: f64): f64 {
  if (!isInt(n) || n < 1.0 || !isInt(k) || k < 0.0) return NaN;
  const nn: i64 = <i64>n;
  let sum: f64 = 0.0;
  for (let i: i64 = 1; i * i <= nn; i++) {
    if (nn % i == 0) {
      sum += Math.pow(<f64>i, k);
      const j: i64 = nn / i;
      if (j != i) sum += Math.pow(<f64>j, k);
    }
  }
  return sum;
}

/** Mobius function mu(n) — 1, 0 or -1. */
export function moebiusMu(n: f64): f64 {
  if (!isInt(n) || n < 1.0) return NaN;
  if (n == 1.0) return 1.0;
  let m: i64 = <i64>n;
  let numFactors: i32 = 0;
  for (let p: i64 = 2; p * p <= m; p++) {
    if (m % p == 0) {
      m /= p;
      if (m % p == 0) return 0.0;
      numFactors++;
    }
  }
  if (m > 1) numFactors++;
  return numFactors % 2 == 0 ? 1.0 : -1.0;
}

function carmichaelPrimePower(p: i64, pk: i64): i64 {
  if (p == 2) {
    if (pk <= 2) return 1;
    if (pk == 4) return 2;
    return pk / 4;
  }
  return (pk / p) * (p - 1);
}

/** Carmichael function lambda(n). */
export function carmichaelLambda(n: f64): f64 {
  if (!isInt(n) || n < 1.0) return NaN;
  if (n == 1.0) return 1.0;
  let m: i64 = <i64>n;
  let result: i64 = 1;
  for (let p: i64 = 2; p * p <= m; p++) {
    if (m % p == 0) {
      let pk: i64 = 1;
      while (m % p == 0) {
        pk *= p;
        m /= p;
      }
      result = lcmU(result, carmichaelPrimePower(p, pk));
    }
  }
  if (m > 1) result = lcmU(result, m - 1);
  return <f64>result;
}

/** Jacobi symbol (a / n) — n a positive odd integer. */
export function jacobiSymbol(a: f64, n: f64): f64 {
  if (!isInt(a) || !isInt(n)) return NaN;
  const ni: i64 = <i64>n;
  if (ni < 1 || ni % 2 == 0) return NaN;
  if (ni == 1) return 1.0;
  const ai: i64 = <i64>a;
  let aa: i64 = ((ai % ni) + ni) % ni;
  let nn: i64 = ni;
  let result: i64 = 1;
  while (aa != 0) {
    while (aa % 2 == 0) {
      aa /= 2;
      if (nn % 8 == 3 || nn % 8 == 5) result = -result;
    }
    const t: i64 = aa;
    aa = nn;
    nn = t;
    if (aa % 4 == 3 && nn % 4 == 3) result = -result;
    aa %= nn;
  }
  return nn == 1 ? <f64>result : 0.0;
}

/** n-th harmonic number H(n). */
export function harmonicNumber(n: f64): f64 {
  if (!isInt(n) || n < 1.0) return NaN;
  const nn: i64 = <i64>n;
  let sum: f64 = 0.0;
  for (let i: i64 = 1; i <= nn; i++) sum += 1.0 / <f64>i;
  return sum;
}

/** Integer partition count p(n). */
export function partitions(n: f64): f64 {
  if (!isInt(n) || n < 0.0) return NaN;
  const nn: i32 = <i32>n;
  const dp = new Float64Array(nn + 1);
  dp[0] = 1.0;
  for (let k: i32 = 1; k <= nn; k++) {
    for (let i: i32 = k; i <= nn; i++) dp[i] += dp[i - k];
  }
  return dp[nn];
}

/** Prime factorization of n >= 2 (with multiplicity, ascending). */
export function primeFactors(n: f64): Float64Array {
  if (!isInt(n) || n < 2.0) return new Float64Array(0);
  let count: i32 = 0;
  let mc: i64 = <i64>n;
  for (let d: i64 = 2; d * d <= mc; d++) {
    while (mc % d == 0) {
      count++;
      mc /= d;
    }
  }
  if (mc > 1) count++;

  const out = new Float64Array(count);
  let m: i64 = <i64>n;
  let idx: i32 = 0;
  for (let d: i64 = 2; d * d <= m; d++) {
    while (m % d == 0) {
      out[idx++] = <f64>d;
      m /= d;
    }
  }
  if (m > 1) out[idx++] = <f64>m;
  return out;
}

/** All positive divisors of n >= 1, ascending. */
export function divisors(n: f64): Float64Array {
  if (!isInt(n) || n < 1.0) return new Float64Array(0);
  const nn: i64 = <i64>n;
  let count: i32 = 0;
  for (let i: i64 = 1; i * i <= nn; i++) {
    if (nn % i == 0) count += i == nn / i ? 1 : 2;
  }
  const out = new Float64Array(count);
  let small: i32 = 0;
  let large: i32 = count - 1;
  for (let i: i64 = 1; i * i <= nn; i++) {
    if (nn % i == 0) {
      out[small++] = <f64>i;
      const j: i64 = nn / i;
      if (j != i) out[large--] = <f64>j;
    }
  }
  return out;
}

/** Digits of n >= 0 in base >= 2, most-significant first. */
export function integerDigits(n: f64, base: f64): Float64Array {
  if (!isInt(n) || n < 0.0 || !isInt(base) || base < 2.0) {
    return new Float64Array(0);
  }
  const nn: i64 = <i64>n;
  const b: i64 = <i64>base;
  if (nn == 0) {
    const zero = new Float64Array(1);
    zero[0] = 0.0;
    return zero;
  }
  let count: i32 = 0;
  let m: i64 = nn;
  while (m > 0) {
    count++;
    m /= b;
  }
  const out = new Float64Array(count);
  m = nn;
  let idx: i32 = count - 1;
  while (m > 0) {
    out[idx--] = <f64>(m % b);
    m /= b;
  }
  return out;
}

function modInverse(a: i64, m: i64): i64 {
  let oldR: i64 = a;
  let r: i64 = m;
  let oldS: i64 = 1;
  let s: i64 = 0;
  while (r != 0) {
    const q: i64 = oldR / r;
    const nr: i64 = oldR - q * r;
    oldR = r;
    r = nr;
    const ns: i64 = oldS - q * s;
    oldS = s;
    s = ns;
  }
  if (oldR != 1) return -1;
  return ((oldS % m) + m) % m;
}

/** Chinese Remainder Theorem solver — moduli must be pairwise coprime. */
export function chineseRemainder(
  rem: Float64Array,
  mods: Float64Array
): f64 {
  const n: i32 = rem.length;
  if (n == 0 || mods.length != n) return NaN;
  let bigM: i64 = 1;
  for (let i: i32 = 0; i < n; i++) {
    const mi: f64 = mods[i];
    if (mi < 1.0 || Math.floor(mi) != mi) return NaN;
    bigM *= <i64>mi;
  }
  let x: i64 = 0;
  for (let i: i32 = 0; i < n; i++) {
    if (!isInt(rem[i])) return NaN;
    const modi: i64 = <i64>mods[i];
    const mi: i64 = bigM / modi;
    const yi: i64 = modInverse(((mi % modi) + modi) % modi, modi);
    if (yi == -1) return NaN;
    x += (<i64>rem[i]) * mi * yi;
  }
  return <f64>(((x % bigM) + bigM) % bigM);
}
