/**
 * Worker-bundle copies of core numeric helpers.
 *
 * Canonical implementations: `mulberry32`, `rowMajorStrides`, `pairwiseSum`,
 * `pairwiseDot`, `norm2` and `scaledDistance` in `@danielsimonjr/mathts-core`. This file is a copy because the worker entry
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
 * A NaN element yields `[NaN, NaN]`.
 */
export function _workerScaledSsq(
  xs: ArrayLike<number>,
  start = 0,
  end = xs.length
): [number, number] {
  let scale = 0;
  let ssq = 1;

  for (let i = start; i < end; i++) {
    const x = xs[i];
    if (x === 0) continue;
    if (Number.isNaN(x)) return [NaN, NaN];

    const ax = Math.abs(x);
    if (scale < ax) {
      const r = scale / ax;
      ssq = 1 + ssq * r * r;
      scale = ax;
    } else {
      const r = ax / scale;
      ssq += r * r;
    }
  }

  return [scale, ssq];
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

  for (let i = start; i < end; i++) {
    const d = a[i] - b[i];
    if (d === 0) continue;
    if (Number.isNaN(d)) return [NaN, NaN];

    const ad = Math.abs(d);
    if (scale < ad) {
      const r = scale / ad;
      ssq = 1 + ssq * r * r;
      scale = ad;
    } else {
      const r = ad / scale;
      ssq += r * r;
    }
  }

  return [scale, ssq];
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
  for (const [s] of parts) {
    if (Number.isNaN(s)) return NaN;
    if (s > scale) scale = s;
  }
  if (scale === 0) return 0;
  if (scale === Infinity) return Infinity;

  let ssq = 0;
  for (const [s, q] of parts) {
    if (s === 0) continue;
    const r = s / scale;
    ssq += q * r * r;
  }
  return scale * Math.sqrt(ssq);
}
