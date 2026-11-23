/**
 * Worker-bundle copies of core numeric helpers.
 *
 * Canonical implementations: `mulberry32`, `rowMajorStrides`, `pairwiseSum`,
 * `pairwiseDot`, `norm2`, `scaledDistance`, `SQUARES_SAFE_MIN` and `powerOfTwoBelow` in
 * `@danielsimonjr/mathts-core`. This file is a copy because the worker entry
 * (`dist/worker.js`) cannot import core:
 *
 * - tsdown externalizes package deps, so a bare `@danielsimonjr/mathts-core`
 *   import in the worker would not resolve in a browser worker.
 * - `deps.alwaysBundle` / `noExternal` on the core barrel inlines core's
 *   pre-bundled `dist/index.js` (typed-function, Unit, factory, …), not the
 *   numeric functions.
 * - This package exports `./worker` types from `dist/worker.d.ts`. A source
 *   import of core would make those types depend on core without a published
 *   dependency.
 *
 * `@danielsimonjr/mathts-core` is a **devDependency** only (parity test).
 * Keep the bodies in lockstep with core; `tests/worker-numerics.test.ts` pins
 * that.
 */

/**
 * Row-major strides for a shape array (worker copy).
 */
export function _tdRowMajorStrides(shape: readonly number[]): number[] {
  const strides = new Array<number>(shape.length);
  let stride = 1;
  for (let i = shape.length - 1; i >= 0; i--) {
    strides[i] = stride;
    stride *= shape[i];
  }
  return strides;
}

/**
 * Mulberry32 seeded PRNG (worker copy).
 *
 * Reference: Tommy Ettinger,
 * https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 * Period: 2^32.
 */
export function _workerMulberry32(seed: number): () => number {
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

// -----------------------------------------------------------------------------
// Stable reductions (worker copies of core/src/numeric/stable.ts)
//
// `ComputePool`'s sequential path uses core's `pairwiseSum` / `pairwiseDot` / `norm2` /
// `scaledDistance`. The worker kernels used naive accumulation, so the same call returned
// different digits depending on whether it crossed the parallel threshold. These copies keep
// the bodies identical to core (only the names carry the `_worker` prefix);
// `tests/worker-numerics.test.ts` pins bit-for-bit parity.
// -----------------------------------------------------------------------------

/**
 * The smallest finite sum of squares that keeps all its digits, 2^-800 (worker copy of core's
 * `SQUARES_SAFE_MIN`; the derivation is in its JSDoc). `tests/subnormal-std-1280.test.ts` pins the
 * copy equal to core.
 */
export const _WORKER_SQUARES_SAFE_MIN = 2 ** -800;

/**
 * The power of 2 `p` with `p <= max < 2 * p` (worker copy of core's `powerOfTwoBelow`). `max` is a
 * finite number above 0.
 */
export function _workerPowerOfTwoBelow(max: number): number {
  let k = Math.floor(Math.log2(max));
  if (2 ** k > max) k--;
  else if (2 ** (k + 1) <= max) k++;
  return 2 ** k;
}

/** Block size of the pairwise leaves (worker copy of core's `PAIRWISE_BLOCK`). */
const PAIRWISE_BLOCK = 128;

/**
 * Pairwise (cascade) sum over `[start, end)` (worker copy of core `pairwiseSum`).
 */
export function _workerPairwiseSum(xs: ArrayLike<number>, start = 0, end = xs.length): number {
  const n = end - start;

  if (n <= PAIRWISE_BLOCK) {
    // Unrolled by 8: this is the leaf of the recursion and where all the time goes. Eight
    // independent accumulators also break the serial dependency chain, which lets the CPU keep
    // several additions in flight.
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let s5 = 0;
    let s6 = 0;
    let s7 = 0;

    let i = start;
    const limit = start + (n - (n % 8));
    for (; i < limit; i += 8) {
      s0 += xs[i];
      s1 += xs[i + 1];
      s2 += xs[i + 2];
      s3 += xs[i + 3];
      s4 += xs[i + 4];
      s5 += xs[i + 5];
      s6 += xs[i + 6];
      s7 += xs[i + 7];
    }

    let tail = 0;
    for (; i < end; i++) tail += xs[i];

    // Combine the partials pairwise too, not left-to-right.
    return s0 + s1 + (s2 + s3) + (s4 + s5 + (s6 + s7)) + tail;
  }

  // Split on an even boundary so both halves stay block-aligned.
  const half = (n >> 1) - ((n >> 1) % 8);
  return _workerPairwiseSum(xs, start, start + half) + _workerPairwiseSum(xs, start + half, end);
}

/**
 * Pairwise dot product over `[start, end)` (worker copy of core `pairwiseDot`).
 */
export function _workerPairwiseDot(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  start = 0,
  end = a.length
): number {
  const n = end - start;

  if (n <= PAIRWISE_BLOCK) {
    // Eight independent accumulators, exactly as in pairwiseSum, so the multiply-adds stay in
    // flight instead of serialising on one running total.
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let s5 = 0;
    let s6 = 0;
    let s7 = 0;

    let i = start;
    const limit = start + (n - (n % 8));
    for (; i < limit; i += 8) {
      s0 += a[i] * b[i];
      s1 += a[i + 1] * b[i + 1];
      s2 += a[i + 2] * b[i + 2];
      s3 += a[i + 3] * b[i + 3];
      s4 += a[i + 4] * b[i + 4];
      s5 += a[i + 5] * b[i + 5];
      s6 += a[i + 6] * b[i + 6];
      s7 += a[i + 7] * b[i + 7];
    }

    let tail = 0;
    for (; i < end; i++) tail += a[i] * b[i];

    return s0 + s1 + (s2 + s3) + (s4 + s5 + (s6 + s7)) + tail;
  }

  const half = (n >> 1) - ((n >> 1) % 8);
  return (
    _workerPairwiseDot(a, b, start, start + half) + _workerPairwiseDot(a, b, start + half, end)
  );
}

/**
 * Scaled sum of squares of `xs[start..end)` as a `[scale, ssq]` partial, with the
 * BLAS `dnrm2` update used by core's `norm2` (which returns `scale * sqrt(ssq)`).
 * An infinite element yields `[Infinity, 1]`, also with a NaN element; else a NaN element
 * yields `[NaN, NaN]` (the IEEE 754 rule of `hypot`, #1259).
 */
export function _workerScaledSsq(
  xs: ArrayLike<number>,
  start = 0,
  end = xs.length
): [number, number] {
  let scale = 0;
  let ssq = 1;
  let nan = false;

  for (let i = start; i < end; i++) {
    const x = xs[i];
    if (x === 0) continue;
    if (Number.isNaN(x)) {
      nan = true;
      continue;
    }
    const ax = Math.abs(x);
    if (ax === Infinity) return [Infinity, 1];
    if (scale < ax) {
      const r = scale / ax;
      ssq = 1 + ssq * r * r;
      scale = ax;
    } else {
      const r = ax / scale;
      ssq += r * r;
    }
  }

  return nan ? [NaN, NaN] : [scale, ssq];
}

/**
 * Scaled sum of squares of the differences `a[i] - b[i]` over `[start, end)`; the
 * partial behind core's `scaledDistance`.
 */
export function _workerScaledSsqDiff(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  start = 0,
  end = a.length
): [number, number] {
  let scale = 0;
  let ssq = 1;
  let nan = false;

  for (let i = start; i < end; i++) {
    const d = a[i] - b[i];
    if (d === 0) continue;
    if (Number.isNaN(d)) {
      nan = true;
      continue;
    }
    const ad = Math.abs(d);
    if (ad === Infinity) return [Infinity, 1];
    if (scale < ad) {
      const r = scale / ad;
      ssq = 1 + ssq * r * r;
      scale = ad;
    } else {
      const r = ad / scale;
      ssq += r * r;
    }
  }

  return nan ? [NaN, NaN] : [scale, ssq];
}

/**
 * Combine `[scale, ssq]` partials from {@link _workerScaledSsq} /
 * {@link _workerScaledSsqDiff} into the 2-norm `scale * sqrt(ssq)`.
 *
 * Each partial is rebased onto the largest scale, so no squared magnitude is ever formed
 * outside [0, 1]: a vector of 1e200s combines to a finite norm instead of Infinity.
 */
export function _workerCombineScaledSsq(parts: ReadonlyArray<readonly [number, number]>): number {
  let scale = 0;
  let nan = false;
  for (const [s] of parts) {
    if (s === Infinity) return Infinity;
    if (Number.isNaN(s)) nan = true;
    else if (s > scale) scale = s;
  }
  if (nan) return NaN;
  if (scale === 0) return 0;

  let ssq = 0;
  for (const [s, q] of parts) {
    if (s === 0) continue;
    const r = s / scale;
    ssq += q * r * r;
  }
  return scale * Math.sqrt(ssq);
}

/** The minimum and the maximum of a range, with the index of each. */
export interface WorkerExtrema {
  min: number;
  max: number;
  minIdx: number;
  maxIdx: number;
}

/**
 * Copy of core `extrema`: the minimum and the maximum of `xs[start..end)`, with their indexes.
 * NaN propagates: a range with a NaN gives NaN for the minimum and the maximum, at the index of the first NaN. An equal
 * later value does not replace the first one. An empty range gives `Infinity`, `-Infinity` and -1.
 * `tests/worker-numerics.test.ts` pins `_workerExtrema` to core.
 */
export function _workerExtrema(xs: ArrayLike<number>, start = 0, end = xs.length): WorkerExtrema {
  let min = Infinity;
  let max = -Infinity;
  let minIdx = -1;
  let maxIdx = -1;
  for (let i = start; i < end; i++) {
    const x = xs[i];
    if (x !== x) return { min: NaN, max: NaN, minIdx: i, maxIdx: i };
    if (x < min || minIdx < 0) {
      min = x;
      minIdx = i;
    }
    if (x > max || maxIdx < 0) {
      max = x;
      maxIdx = i;
    }
  }
  return { min, max, minIdx, maxIdx };
}

/**
 * Combine the extrema of consecutive chunks, in chunk order, with the rule of `_workerExtrema`.
 * The first chunk that holds a NaN decides. On a tie, the earlier chunk keeps its value.
 */
export function _workerCombineExtrema(parts: ReadonlyArray<WorkerExtrema>): WorkerExtrema {
  let out: WorkerExtrema = { min: Infinity, max: -Infinity, minIdx: -1, maxIdx: -1 };
  for (const p of parts) {
    if (p.minIdx < 0) continue; // an empty chunk
    if (p.min !== p.min) return p;
    if (p.min < out.min || out.minIdx < 0) out = { ...out, min: p.min, minIdx: p.minIdx };
    if (p.max > out.max || out.maxIdx < 0) out = { ...out, max: p.max, maxIdx: p.maxIdx };
  }
  return out;
}
