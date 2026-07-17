/**
 * Monte-Carlo and quasi-Monte-Carlo (QMC) integration over an axis-aligned
 * box.
 *
 * `monteCarloIntegrate` estimates `∫ f` over `bounds` (one `[lo, hi]` pair
 * per dimension) by averaging `f` over `n` sample points scaled into the
 * box, times the box volume. Three sampling methods:
 *
 * - `'uniform'` (default): plain pseudo-random sampling via the package's
 *   existing seeded RNG (`../probability/util/seededRNG.ts`), for
 *   reproducibility. `stderr` is the usual `sqrt(sample variance / n)`,
 *   scaled by the box volume — a genuine confidence-interval radius since
 *   samples are i.i.d.
 * - `'halton'`: a generalized Halton (van der Corput) low-discrepancy
 *   sequence, one prime base per dimension. Deterministic, any dimension.
 * - `'sobol'`: a genuine Sobol (base-2 digital net) sequence using the
 *   Antonov-Saleev (Gray-code) point ordering, restricted to the first two
 *   Sobol dimensions. Those two are the only dimensions whose direction
 *   numbers are *fully forced* by the Sobol recurrence with no free seed
 *   choice (dimension 1 has no primitive polynomial — plain base-2 van der
 *   Corput; dimension 2's primitive polynomial `x + 1` has degree 1, so its
 *   single seed is forced to the only valid value, 1) — so this needs no
 *   externally-sourced direction-number table. Verified against
 *   `scipy.stats.qmc.Sobol(d=2, scramble=False)`, which matches point for
 *   point. Higher-dimensional Sobol needs the standard Joe-Kuo direction
 *   number tables (out of scope here) — use `'halton'` instead, which is
 *   dimension-general.
 *
 * QMC methods return `stderr: 0` — their points are not independent, so a
 * variance-based standard error is not meaningful; their accuracy comes
 * instead from the sequence's low discrepancy (empirically ~`1/n` error
 * decay vs. uniform MC's `1/sqrt(n)`).
 *
 * @packageDocumentation
 */
import { createRng } from '../probability/util/seededRNG.js';

type f64 = number;
type i32 = number;

/** An axis-aligned integration bound `[lo, hi]`. */
export type Bound = readonly [f64, f64];

/** Options for {@link monteCarloIntegrate}. */
export interface MonteCarloOptions {
  /** Number of sample points (default 1e5). */
  n?: i32;
  /** Sampling method (default `'uniform'`). */
  method?: 'uniform' | 'halton' | 'sobol';
  /** Seed for the deterministic RNG, `method: 'uniform'` only (reproducible
   * draws). Omit for a time-seeded, non-reproducible generator. */
  seed?: string | number;
}

/** Result of {@link monteCarloIntegrate}. */
export interface MonteCarloResult {
  /** The estimated integral. */
  estimate: f64;
  /** Standard error of `estimate` (uniform MC only; 0 for QMC methods —
   * see the module doc). */
  stderr: f64;
}

// --- Halton (generalized van der Corput) sequence ------------------------

function isPrime(x: i32): boolean {
  if (x < 2) return false;
  for (let i = 2; i * i <= x; i++) {
    if (x % i === 0) return false;
  }
  return true;
}

function nthPrime(k: i32): i32 {
  let count = 0;
  let candidate = 1;
  while (count < k) {
    candidate++;
    if (isPrime(candidate)) count++;
  }
  return candidate;
}

function vanDerCorput(idx: i32, base: i32): f64 {
  let f = 1;
  let r = 0;
  let i = idx;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

function haltonSequence(n: i32, dims: i32): f64[][] {
  const bases = Array.from({ length: dims }, (_, d) => nthPrime(d + 1));
  const points: f64[][] = [];
  for (let idx = 1; idx <= n; idx++) {
    points.push(bases.map((b) => vanDerCorput(idx, b)));
  }
  return points;
}

// --- Sobol sequence (dimensions 1-2 only; see module doc) ----------------

const SOBOL_BITS = 30;

/** Forced direction numbers M_i (Sobol/Bratley-Fox recurrence) for the
 * first two dimensions — neither has a free seed choice, so these are
 * derived, not looked up (see module doc). `dim` 0 = trivial (no primitive
 * polynomial: plain base-2 van der Corput). `dim` 1 = primitive polynomial
 * `x + 1` (degree 1): seed M_1 = 1 (the only odd value < 2^1), recurrence
 * `M_i = (2*M_{i-1}) XOR M_{i-1}` for i > 1. */
function sobolDirectionNumbers(dim: 0 | 1, bits: i32): i32[] {
  const M: i32[] = new Array(bits + 1).fill(0);
  if (dim === 0) {
    for (let i = 1; i <= bits; i++) M[i] = 1;
    return M;
  }
  M[1] = 1;
  for (let i = 2; i <= bits; i++) {
    M[i] = (2 * M[i - 1]) ^ M[i - 1];
  }
  return M;
}

function sobolSequence(n: i32, dims: i32): f64[][] {
  if (dims < 1 || dims > 2) {
    throw new Error(
      "monteCarloIntegrate: method 'sobol' supports only 1-2 dimensions here " +
        '(only the first two Sobol direction-number sets are forced by the ' +
        "recurrence with no external lookup table); use method: 'halton' for " +
        'higher-dimensional integrals'
    );
  }
  const bits = SOBOL_BITS;
  const scale = Math.pow(2, bits);
  const scaledDir = Array.from({ length: dims }, (_, d) => {
    const M = sobolDirectionNumbers(d as 0 | 1, bits);
    return M.map((m, i) => (i === 0 ? 0 : m * Math.pow(2, bits - i)));
  });

  const points: f64[][] = [];
  for (let idx = 1; idx <= n; idx++) {
    // Antonov-Saleev (Gray-code) ordering: point idx uses the direction
    // numbers for the bits set in gray(idx), not idx itself. Verified
    // point-for-point against scipy.stats.qmc.Sobol(d=2, scramble=False).
    const gray = idx ^ (idx >>> 1);
    const pt: f64[] = new Array(dims).fill(0);
    for (let d = 0; d < dims; d++) {
      let acc = 0;
      let k = gray;
      let bitPos = 1;
      while (k > 0) {
        if (k & 1) acc ^= scaledDir[d][bitPos];
        k >>>= 1;
        bitPos++;
      }
      pt[d] = acc / scale;
    }
    points.push(pt);
  }
  return points;
}

// --- Monte-Carlo / QMC integration ---------------------------------------

/**
 * Estimate `∫ f` over the axis-aligned box `bounds` (one `[lo, hi]` pair
 * per dimension) by Monte-Carlo or quasi-Monte-Carlo sampling.
 *
 * @example
 * monteCarloIntegrate((x) => x[0] ** 2, [[0, 1]], { n: 1e5, seed: 42 });
 * // estimate ~ 1/3, stderr ~ 6e-4
 *
 * @example
 * // unit-disk area via the indicator function, ~ pi
 * monteCarloIntegrate((x) => (x[0] ** 2 + x[1] ** 2 <= 1 ? 1 : 0), [
 *   [-1, 1],
 *   [-1, 1],
 * ]);
 */
export function monteCarloIntegrate(
  f: (x: f64[]) => f64,
  bounds: readonly Bound[],
  opts: MonteCarloOptions = {}
): MonteCarloResult {
  const dims = bounds.length;
  if (dims === 0) {
    throw new Error('monteCarloIntegrate: bounds must have at least one dimension');
  }
  for (const [lo, hi] of bounds) {
    if (!(hi > lo)) throw new Error('monteCarloIntegrate: each bound must have hi > lo');
  }
  const n = Math.floor(opts.n ?? 1e5);
  if (n < 1) throw new Error('monteCarloIntegrate: n must be >= 1');
  const method = opts.method ?? 'uniform';
  const volume = bounds.reduce((v, [lo, hi]) => v * (hi - lo), 1);

  let unitPoints: f64[][];
  if (method === 'uniform') {
    const rng = createRng(opts.seed ?? null);
    unitPoints = Array.from({ length: n }, () => Array.from({ length: dims }, () => rng()));
  } else if (method === 'halton') {
    unitPoints = haltonSequence(n, dims);
  } else if (method === 'sobol') {
    unitPoints = sobolSequence(n, dims);
  } else {
    throw new Error(`monteCarloIntegrate: unknown method '${String(method)}'`);
  }

  let sum = 0;
  let sumSq = 0;
  for (const u of unitPoints) {
    const x = u.map((ui, d) => bounds[d][0] + ui * (bounds[d][1] - bounds[d][0]));
    const fx = f(x);
    sum += fx;
    sumSq += fx * fx;
  }
  const mean = sum / n;
  const estimate = volume * mean;

  if (method !== 'uniform') {
    return { estimate, stderr: 0 };
  }
  const variance = n > 1 ? Math.max(0, sumSq - n * mean * mean) / (n - 1) : 0;
  const stderr = volume * Math.sqrt(variance / n);
  return { estimate, stderr };
}
