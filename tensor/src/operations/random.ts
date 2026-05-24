/**
 * randomTensor — construct a Tensor filled with pseudo-random values.
 *
 * Supported distributions:
 *   'uniform'    — U(0, 1) via the seeded PRNG or Math.random().
 *   'normal'     — N(0, 1) via Box–Muller transform on the underlying PRNG.
 *   'orthogonal' — Uniform on the orthogonal group O(n) via QR decomposition
 *                  of a normal random matrix. Rank-2 shapes only.
 *
 * Seeded RNG: Mulberry32 — a small, fast, high-quality 32-bit PRNG.
 * Reference: Tommy Ettinger, https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 *
 * WARNING: The seeded path is NOT cryptographically secure. Do not use for
 * security-sensitive purposes (key generation, nonces, etc.).
 */

import { Tensor } from '../Tensor.js';
import { Index } from '../named-index.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RandomTensorOpts {
  /**
   * Distribution to sample from.
   *
   * - `'uniform'`     — U(0, 1).
   * - `'normal'`      — N(0, 1) via Box–Muller transform.
   * - `'orthogonal'`  — uniform on the orthogonal group; rank-2 shape only.
   *
   * @default 'uniform'
   */
  distribution?: 'uniform' | 'normal' | 'orthogonal';

  /**
   * Integer seed for the Mulberry32 PRNG. When omitted, Math.random() is
   * used (non-reproducible). NOT cryptographically secure.
   */
  seed?: number;

  /**
   * Optional axis labels forwarded into the new Tensor's constructor.
   * Requires Phase-1 `axisLabels` support in the Tensor constructor
   * (constructor signature: `Tensor(shape, data, axisLabels?)`).
   */
  axisLabels?: ReadonlyArray<Index>;
}

// ---------------------------------------------------------------------------
// Mulberry32 — seeded 32-bit PRNG
// ---------------------------------------------------------------------------

/**
 * Create a Mulberry32 PRNG seeded with `seed`.
 *
 * Returns a closure that yields uniformly distributed floats in [0, 1) on
 * each call. Mulberry32 has a period of 2^32 and passes PractRand at ≥ 16 GB.
 *
 * NOT cryptographically secure.
 */
function makeMulberry32(seed: number): () => number {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    z = (z ^ (z >>> 14)) >>> 0;
    return z / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Box–Muller transform
// ---------------------------------------------------------------------------

/**
 * Generate a pair of independent N(0,1) samples from two U(0,1) inputs via
 * the Box–Muller transform.
 */
function boxMuller(u1: number, u2: number): [number, number] {
  // Clamp u1 away from 0 to avoid log(0).
  const clamped = u1 === 0 ? Number.EPSILON : u1;
  const r = Math.sqrt(-2 * Math.log(clamped));
  const theta = 2 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

// ---------------------------------------------------------------------------
// Gram–Schmidt QR decomposition (thin Q)
// ---------------------------------------------------------------------------

/**
 * Compute the thin Q factor of a matrix stored as a flat Float64Array in
 * row-major order with shape [rows, cols].  Returns a Float64Array of shape
 * [rows, cols] whose columns are orthonormal.
 *
 * Uses classical Gram–Schmidt with re-orthogonalisation for numerical
 * stability. This is an internal helper for the 'orthogonal' distribution
 * and is NOT exported.
 *
 * For the orthogonal distribution we need Q from the QR factorisation of a
 * random normal matrix (rows >= cols).  When rows === cols the result is a
 * uniform random orthogonal matrix.
 */
function thinQR(data: Float64Array, rows: number, cols: number): Float64Array {
  // Work with column vectors stored as contiguous segments of length `rows`.
  // We build them in-place in a (rows × cols) column-major scratch space.
  const Q = new Float64Array(rows * cols); // column-major: Q[i + j*rows]

  for (let j = 0; j < cols; j++) {
    // Copy the j-th column of `data` (row-major) into scratch.
    for (let i = 0; i < rows; i++) {
      Q[i + j * rows] = data[i * cols + j];
    }

    // Orthogonalise against already-computed columns (classic Gram–Schmidt).
    for (let k = 0; k < j; k++) {
      // dot product: Q[:,k] · Q[:,j]
      let dot = 0;
      for (let i = 0; i < rows; i++) dot += Q[i + k * rows] * Q[i + j * rows];
      // subtract projection
      for (let i = 0; i < rows; i++) Q[i + j * rows] -= dot * Q[i + k * rows];
    }

    // Re-orthogonalise once for numerical stability.
    for (let k = 0; k < j; k++) {
      let dot = 0;
      for (let i = 0; i < rows; i++) dot += Q[i + k * rows] * Q[i + j * rows];
      for (let i = 0; i < rows; i++) Q[i + j * rows] -= dot * Q[i + k * rows];
    }

    // Normalise.
    let norm = 0;
    for (let i = 0; i < rows; i++) norm += Q[i + j * rows] ** 2;
    norm = Math.sqrt(norm);
    if (norm < 1e-14) {
      // Degenerate column — should not happen for a random normal matrix.
      throw new Error('randomTensor: degenerate column during QR (near-zero norm)');
    }
    for (let i = 0; i < rows; i++) Q[i + j * rows] /= norm;
  }

  // Convert back to row-major Float64Array of shape [rows, cols].
  const out = new Float64Array(rows * cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[i * cols + j] = Q[i + j * rows];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Construct a Tensor of the given `shape` filled with pseudo-random values.
 *
 * @param shape  - Array of positive integers defining the tensor dimensions.
 * @param opts   - Optional configuration (distribution, seed, axisLabels).
 * @returns A new Tensor.
 *
 * @example
 * ```ts
 * // 3×4 uniform random tensor
 * const t = randomTensor([3, 4]);
 *
 * // Seeded normal random vector (reproducible)
 * const v = randomTensor([100], { distribution: 'normal', seed: 42 });
 *
 * // 8×8 random orthogonal matrix
 * const O = randomTensor([8, 8], { distribution: 'orthogonal', seed: 7 });
 * ```
 */
export function randomTensor(shape: ReadonlyArray<number>, opts?: RandomTensorOpts): Tensor {
  const distribution = opts?.distribution ?? 'uniform';
  const axisLabels = opts?.axisLabels;

  const size = shape.reduce((acc, d) => acc * d, 1);

  // Build the raw RNG — either seeded Mulberry32 or Math.random.
  const rng: () => number =
    opts?.seed !== undefined ? makeMulberry32(opts.seed) : () => Math.random();

  // ----- 'orthogonal' distribution -----
  if (distribution === 'orthogonal') {
    if (shape.length !== 2) {
      throw new Error("randomTensor: 'orthogonal' distribution requires a rank-2 shape");
    }
    const [rows, cols] = shape as [number, number];
    const totalNormal = rows * cols;

    // Generate a rows×cols normal random matrix.
    const normalData = new Float64Array(totalNormal);
    let idx = 0;
    while (idx < totalNormal - 1) {
      const [z0, z1] = boxMuller(rng(), rng());
      normalData[idx++] = z0;
      normalData[idx++] = z1;
    }
    if (idx < totalNormal) {
      // Odd total — generate one extra Box–Muller pair, use first value.
      const [z0] = boxMuller(rng(), rng());
      normalData[idx] = z0;
    }

    // QR decompose — Q has shape [rows, min(rows, cols)] but we want a square
    // orthogonal matrix.  For square input (rows === cols) the thin and full
    // Q coincide.  For non-square inputs the thin Q (rows × cols for rows>cols,
    // or rows × rows for rows<cols) is the useful orthonormal factor.
    const qCols = Math.min(rows, cols);
    const qData = thinQR(normalData, rows, qCols);

    // If the requested shape is square (rows === cols), qData is already
    // rows×cols.  If rows > cols we get a tall rectangular orthonormal matrix.
    // Either way, build a Tensor of shape [rows, qCols].
    const outShape: number[] = [rows, qCols];
    return new Tensor(outShape, qData, axisLabels as ReadonlyArray<Index> | undefined);
  }

  // ----- 'uniform' and 'normal' distributions -----
  const data = new Float64Array(size);

  if (distribution === 'uniform') {
    for (let i = 0; i < size; i++) {
      data[i] = rng();
    }
  } else if (distribution === 'normal') {
    let i = 0;
    while (i < size - 1) {
      const [z0, z1] = boxMuller(rng(), rng());
      data[i++] = z0;
      data[i++] = z1;
    }
    if (i < size) {
      const [z0] = boxMuller(rng(), rng());
      data[i] = z0;
    }
  } else {
    // TypeScript exhaustiveness guard — should never reach here.
    const _exhaustive: never = distribution;
    throw new Error(`randomTensor: unknown distribution '${String(_exhaustive)}'`);
  }

  return new Tensor([...shape], data, axisLabels as ReadonlyArray<Index> | undefined);
}
