/**
 * Shared radix-2 FFT core for @danielsimonjr/mathts-workerpool.
 *
 * Exported only for internal use by `worker.ts` and `index.ts`. Not part of
 * the package's public API. The bundler emits it as a chunk that both entry
 * points import — the goal here is a single source of truth in `src/`.
 *
 * NOTE: The canonical JS FFT core lives in `functions/src/signal/fft-core-f64.ts`
 * (imported by `functions/src/typed/signal.ts`). Pulling it across the package
 * boundary would violate the layering rules, so this file stays a separate copy.
 *
 * @packageDocumentation
 */

/**
 * Bit-reverse an integer over `bits` bits (radix-2 FFT reordering helper).
 */
export function fftBitReverse(x: number, bits: number): number {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

/**
 * Default most bytes of twiddle tables kept for reuse. A table of size n holds n/2 cos and n/2
 * sin values, so it takes 8n bytes. A table larger than the cap is built on each call and not
 * kept. Measured on Bun: building the table of 2^22 points takes 44 ms against 1,300 ms for the
 * transform (3%); at 2^20 it takes 17 ms against 156 ms (11%). The default keeps one table of
 * 2^22 points, so the three transforms of one Bluestein call of up to 2^21 points share it.
 */
export const TWIDDLE_CACHE_DEFAULT_MAX_BYTES = 1 << 25;
let twiddleCacheMaxBytes = TWIDDLE_CACHE_DEFAULT_MAX_BYTES;
/** Least recently used first: a hit moves the table to the end, and eviction takes the first. */
const twiddleCache = new Map<number, { cos: Float64Array; sin: Float64Array }>();
let twiddleCacheBytes = 0;

function evictTwiddlesDownTo(limit: number): void {
  for (const [oldSize] of twiddleCache) {
    if (twiddleCacheBytes <= limit) break;
    twiddleCache.delete(oldSize);
    twiddleCacheBytes -= 8 * oldSize;
  }
}

/** Sets the byte cap and evicts down to it. A cap of 0 empties the cache. For tests. */
export function setTwiddleCacheMaxBytes(bytes: number): void {
  twiddleCacheMaxBytes = bytes;
  evictTwiddlesDownTo(bytes);
}

/** The sizes kept (least recently used first) and their total bytes. For tests. */
export function twiddleCacheState(): { sizes: number[]; bytes: number } {
  return { sizes: Array.from(twiddleCache.keys()), bytes: twiddleCacheBytes };
}

/**
 * The forward twiddles `exp(-2 pi i k / n)` for k in [0, n/2), as cos and sin tables.
 * Same arithmetic as `functions/src/signal/fft-core-f64.ts`: one trig call per index, so the
 * two copies agree bit for bit on the same runtime.
 */
function forwardTwiddles(n: number): { cos: Float64Array; sin: Float64Array } {
  const hit = twiddleCache.get(n);
  if (hit) {
    twiddleCache.delete(n);
    twiddleCache.set(n, hit);
    return hit;
  }
  const half = n / 2;
  const cos = new Float64Array(half);
  const sin = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    const angle = (-2.0 * Math.PI * k) / n;
    cos[k] = Math.cos(angle);
    sin[k] = Math.sin(angle);
  }
  const table = { cos, sin };
  const bytes = 8 * n;
  if (bytes > twiddleCacheMaxBytes) return table;
  evictTwiddlesDownTo(twiddleCacheMaxBytes - bytes);
  twiddleCache.set(n, table);
  twiddleCacheBytes += bytes;
  return table;
}

/**
 * In-place radix-2 Cooley-Tukey FFT over a single frame.
 *
 * Operates on the [`offset`, `offset + n`) slice of `real`/`imag`. `n` must be
 * a power of two. This is a self-contained copy of
 * `functions/src/signal/fft-core-f64.ts` — the worker sits below the
 * `functions` package in the dependency graph and cannot import it.
 */
export function fftFrameInPlace(
  real: Float64Array,
  imag: Float64Array,
  offset: number,
  n: number,
  inverse: boolean
): void {
  const bits = Math.log2(n) | 0;

  // Bit-reverse reorder within the frame.
  for (let i = 0; i < n; i++) {
    const j = fftBitReverse(i, bits);
    if (j > i) {
      const tr = real[offset + i];
      real[offset + i] = real[offset + j];
      real[offset + j] = tr;
      const ti = imag[offset + i];
      imag[offset + i] = imag[offset + j];
      imag[offset + j] = ti;
    }
  }

  const sign = inverse ? -1.0 : 1.0;
  const { cos: twRe, sin: twIm } = forwardTwiddles(Math.max(n, 2));

  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const stride = n / size;

    for (let start = 0; start < n; start += size) {
      for (let j = 0; j < halfSize; j++) {
        const evenIdx = offset + start + j;
        const oddIdx = offset + start + j + halfSize;
        const wRe = twRe[j * stride];
        const wIm = sign * twIm[j * stride];

        const uRe = real[oddIdx] * wRe - imag[oddIdx] * wIm;
        const uIm = real[oddIdx] * wIm + imag[oddIdx] * wRe;

        const eRe = real[evenIdx];
        const eIm = imag[evenIdx];

        real[evenIdx] = eRe + uRe;
        imag[evenIdx] = eIm + uIm;
        real[oddIdx] = eRe - uRe;
        imag[oddIdx] = eIm - uIm;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      real[offset + i] /= n;
      imag[offset + i] /= n;
    }
  }
}
