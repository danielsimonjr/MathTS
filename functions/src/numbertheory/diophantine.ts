/**
 * Diophantine and lattice-style integer problems: linear Diophantine equations,
 * Pell equations, the Frobenius (coin) number, Zeckendorf representation,
 * sums of two squares, Egyptian fractions and Farey sequences.
 */

function assertInt(n: number, name: string): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${name} must be a safe integer`);
}

function gcdNum(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** Extended Euclid on non-negative a, b: returns [g, u, v] with a*u + b*v = g. */
function extgcd(a: number, b: number): [number, number, number] {
  let [oldR, r] = [a, b];
  let [oldS, s] = [1, 0];
  let [oldT, t] = [0, 1];
  while (r !== 0) {
    const q = Math.floor(oldR / r);
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  return [oldR, oldS, oldT];
}

/**
 * Particular integer solution of a x + b y = c with the general solution
 * x = x0 + stepX * t, y = y0 + stepY * t. Returns null when no solution exists.
 */
export function linearDiophantine(
  a: number,
  b: number,
  c: number
): { x: number; y: number; stepX: number; stepY: number } | null {
  assertInt(a, 'a');
  assertInt(b, 'b');
  assertInt(c, 'c');
  if (a === 0 && b === 0) {
    if (c === 0) throw new RangeError('every (x, y) solves 0x + 0y = 0');
    return null;
  }
  const [g, u, v] = extgcd(Math.abs(a), Math.abs(b));
  if (c % g !== 0) return null;
  const k = c / g;
  const sa = a < 0 ? -1 : 1;
  const sb = b < 0 ? -1 : 1;
  return { x: sa * u * k, y: sb * v * k, stepX: b / g, stepY: 0 - a / g };
}

/**
 * Fundamental solution (x, y) of Pell's equation x^2 - d y^2 = 1 for a positive
 * non-square integer d, via the continued fraction of sqrt(d). Returns null for
 * non-positive or perfect-square d.
 */
export function pellSolve(d: number): { x: bigint; y: bigint } | null {
  assertInt(d, 'd');
  if (d <= 0) return null;
  const D = BigInt(d);
  let a0 = 0n;
  {
    let lo = 0n;
    let hi = 1n << BigInt(Math.ceil(d.toString(2).length / 2) + 1);
    while (lo < hi) {
      const mid = (lo + hi + 1n) / 2n;
      if (mid * mid <= D) lo = mid;
      else hi = mid - 1n;
    }
    a0 = lo;
  }
  if (a0 * a0 === D) return null;

  let m = 0n;
  let dd = 1n;
  let a = a0;
  let pPrev = 1n;
  let p = a0;
  let qPrev = 0n;
  let q = 1n;
  while (p * p - D * q * q !== 1n) {
    m = dd * a - m;
    dd = (D - m * m) / dd;
    a = (a0 + m) / dd;
    [pPrev, p] = [p, a * p + pPrev];
    [qPrev, q] = [q, a * q + qPrev];
  }
  return { x: p, y: q };
}

/**
 * Frobenius number: the largest integer not representable as a non-negative
 * combination of the coins. Requires positive integer coins with gcd 1
 * (otherwise RangeError). Returns -1 when a coin equals 1.
 */
export function frobeniusNumber(coins: readonly number[]): number {
  if (coins.length === 0) throw new RangeError('coins must be non-empty');
  for (const c of coins) {
    if (!Number.isSafeInteger(c) || c < 1) throw new RangeError('coins must be positive integers');
  }
  let g = 0;
  for (const c of coins) g = gcdNum(g, c);
  if (g !== 1) throw new RangeError('coins must have gcd 1');

  // Shortest representable value in each residue class mod the smallest coin.
  const m = Math.min(...coins);
  const dist = new Array<number>(m).fill(Infinity);
  dist[0] = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < m; r++) {
      if (dist[r] === Infinity) continue;
      for (const c of coins) {
        const nr = (r + c) % m;
        const nd = dist[r] + c;
        if (nd < dist[nr]) {
          dist[nr] = nd;
          changed = true;
        }
      }
    }
  }
  return Math.max(...dist) - m;
}

/** Zeckendorf representation of n >= 0 as distinct, non-consecutive Fibonacci parts (descending). */
export function zeckendorf(n: number): number[] {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('n must be a non-negative integer');
  const fibs: number[] = [1, 2];
  while (fibs[fibs.length - 1] <= n) fibs.push(fibs[fibs.length - 1] + fibs[fibs.length - 2]);
  const out: number[] = [];
  let rem = n;
  for (let i = fibs.length - 1; i >= 0 && rem > 0; i--) {
    if (fibs[i] <= rem) {
      out.push(fibs[i]);
      rem -= fibs[i];
    }
  }
  return out;
}

/** All pairs [a, b] with 0 <= a <= b and a^2 + b^2 = n, in ascending order of a. */
export function sumOfTwoSquares(n: number): Array<[number, number]> {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('n must be a non-negative integer');
  const out: Array<[number, number]> = [];
  for (let a = 0; 2 * a * a <= n; a++) {
    const rest = n - a * a;
    const b = Math.round(Math.sqrt(rest));
    for (let bb = Math.max(0, b - 1); bb <= b + 1; bb++) {
      if (bb * bb === rest && a <= bb) {
        out.push([a, bb]);
        break;
      }
    }
  }
  return out;
}

/**
 * Egyptian fraction of p/q (positive integers) by the greedy algorithm: returns
 * the denominators of a decomposition into distinct unit fractions when the
 * greedy steps are distinct (for p/q < 1, the usual case).
 */
export function egyptianFraction(p: number, q: number): number[] {
  if (!Number.isSafeInteger(p) || !Number.isSafeInteger(q) || p < 1 || q < 1) {
    throw new RangeError('p and q must be positive integers');
  }
  let num = BigInt(p);
  let den = BigInt(q);
  const out: number[] = [];
  const bgcd = (x: bigint, y: bigint): bigint => {
    let a = x < 0n ? -x : x;
    let b = y < 0n ? -y : y;
    while (b !== 0n) [a, b] = [b, a % b];
    return a;
  };
  while (num > 0n) {
    // Smallest denominator d with 1/d <= num/den: d = ceil(den/num).
    const d = (den + num - 1n) / num;
    out.push(Number(d));
    // num/den - 1/d = (num*d - den) / (den*d)
    let nn = num * d - den;
    let nd = den * d;
    if (nn > 0n) {
      const g = bgcd(nn, nd);
      nn /= g;
      nd /= g;
    }
    num = nn;
    den = nd;
  }
  return out;
}

/** Farey sequence F_n: reduced fractions [num, den] in [0, 1] with den <= n, ascending. */
export function fareySequence(n: number): Array<[number, number]> {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError('n must be a positive integer');
  let a = 0;
  let b = 1;
  let c = 1;
  let d = n;
  const out: Array<[number, number]> = [[0, 1]];
  while (c <= n) {
    const k = Math.floor((n + b) / d);
    [a, b, c, d] = [c, d, k * c - a, k * d - b];
    out.push([a, b]);
  }
  return out;
}
