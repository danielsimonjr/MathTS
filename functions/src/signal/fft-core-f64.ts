/**
 * The ONE radix-2 Cooley-Tukey core for this package, on flat Float64Arrays.
 *
 * There used to be two. This flat one (used by `parallelFFT`), and a second inside
 * `signal/fft.ts` that did the butterfly arithmetic in Complex OBJECTS — a `{ re, im }`
 * allocation per twiddle step and per butterfly. Same transform, same machine:
 *
 * | n         | flat Float64Array core | Complex-object core |
 * | --------- | ---------------------- | ------------------- |
 * | 262,144   |                  80 ms |              607 ms |
 * | 1,048,576 |                 358 ms |             2987 ms |
 *
 * The public `fft()` used the SLOW one, so the FFT every consumer reaches by default was
 * ~8x slower than the library's own fast path. Its `ComplexNumber[]` return type was not
 * the cause: materialising the objects once at the boundary is cheap — doing the
 * ARITHMETIC in them is what cost 8x. Both surfaces now share this core and box at the
 * edge.
 *
 * Internal. Not part of the public API.
 *
 * @packageDocumentation
 */

/** 32-bit int / 64-bit float aliases, matching the annotations used across `signal/`. */
type i32 = number;
type f64 = number;

/**
 * Bit reverse for FFT
 */
export function bitReverse(x: i32, bits: i32): i32 {
  let result: i32 = 0;
  for (let i: i32 = 0; i < bits; i++) {
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
const twiddleCache = new Map<i32, { cos: Float64Array; sin: Float64Array }>();
let twiddleCacheBytes = 0;

function evictTwiddlesDownTo(limit: i32): void {
  for (const [oldSize] of twiddleCache) {
    if (twiddleCacheBytes <= limit) break;
    twiddleCache.delete(oldSize);
    twiddleCacheBytes -= 8 * oldSize;
  }
}

/** Sets the byte cap and evicts down to it. A cap of 0 empties the cache. For tests. */
export function setTwiddleCacheMaxBytes(bytes: i32): void {
  twiddleCacheMaxBytes = bytes;
  evictTwiddlesDownTo(bytes);
}

/** The sizes kept (least recently used first) and their total bytes. For tests. */
export function twiddleCacheState(): { sizes: i32[]; bytes: i32 } {
  return { sizes: Array.from(twiddleCache.keys()), bytes: twiddleCacheBytes };
}

/**
 * The forward twiddles `exp(-2 pi i k / n)` for k in [0, n/2), as cos and sin tables.
 *
 * Each entry is one `Math.cos` and one `Math.sin` call of its own angle, so the error of a
 * twiddle does not depend on its index. The tables are cached per size. The inverse transform
 * takes the conjugate of the same values, so it needs no second set of trig calls.
 *
 * Why not a running product: a twiddle that is the product of the previous one carries a
 * rounding error that grows with its index (640 ULP of the largest sample for a round trip at
 * n = 4096, against about 4 with this table). With twiddles of fixed relative error, the
 * standard bound for a radix-2 FFT grows as log2(n) times that error (Higham, Accuracy and
 * Stability of Numerical Algorithms, 2nd ed., Theorem 24.2). The test bound of 2 log2(n) ULP
 * follows that growth. It is a measured margin, not a proven constant. `Math.cos` and
 * `Math.sin` still differ in the last bit between V8 and JavaScriptCore, so the result is
 * bounded, not bit-identical across runtimes.
 */
function forwardTwiddles(n: i32): { cos: Float64Array; sin: Float64Array } {
  const hit = twiddleCache.get(n);
  if (hit) {
    twiddleCache.delete(n);
    twiddleCache.set(n, hit);
    return hit;
  }
  const half: i32 = n / 2;
  const cos = new Float64Array(half);
  const sin = new Float64Array(half);
  for (let k: i32 = 0; k < half; k++) {
    const angle: f64 = (-2.0 * Math.PI * k) / n;
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
 * Radix-2 FFT core using Float64Array for WASM compatibility
 */
export function fftCoreFloat64(
  realIn: Float64Array,
  imagIn: Float64Array,
  inverse: boolean = false
): { real: Float64Array; imag: Float64Array } {
  const n: i32 = realIn.length;
  const bits: i32 = Math.log2(n) as i32;

  // Bit-reverse reorder
  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  for (let i: i32 = 0; i < n; i++) {
    const j: i32 = bitReverse(i, bits);
    real[j] = realIn[i];
    imag[j] = imagIn[i];
  }

  // Direction factor: the inverse conjugates the forward twiddles
  const sign: f64 = inverse ? -1.0 : 1.0;
  const { cos: twRe, sin: twIm } = forwardTwiddles(Math.max(n, 2));

  // Butterfly operations
  for (let size: i32 = 2; size <= n; size *= 2) {
    const halfSize: i32 = size / 2;
    const stride: i32 = n / size;

    for (let start: i32 = 0; start < n; start += size) {
      for (let j: i32 = 0; j < halfSize; j++) {
        const evenIdx: i32 = start + j;
        const oddIdx: i32 = start + j + halfSize;
        const wRe: f64 = twRe[j * stride];
        const wIm: f64 = sign * twIm[j * stride];

        // Twiddle factor multiplication
        const uRe: f64 = real[oddIdx] * wRe - imag[oddIdx] * wIm;
        const uIm: f64 = real[oddIdx] * wIm + imag[oddIdx] * wRe;

        // Butterfly
        const eRe: f64 = real[evenIdx];
        const eIm: f64 = imag[evenIdx];

        real[evenIdx] = eRe + uRe;
        imag[evenIdx] = eIm + uIm;
        real[oddIdx] = eRe - uRe;
        imag[oddIdx] = eIm - uIm;
      }
    }
  }

  // Scale for inverse
  if (inverse) {
    for (let i: i32 = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }

  return { real, imag };
}

function nextPow2AtLeast(n: i32): i32 {
  let p: i32 = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * The phase `sign * pi * k^2 / n` of the Bluestein chirp, reduced to one turn first: `k^2 mod 2n`
 * is exact in integers, and `exp(i pi k^2 / n)` repeats with that period. Without the reduction
 * the angle reaches `pi * n`, and its rounding error (about `n * 1e-16`) is the error of the
 * whole transform. At n = 4093 the error against a direct DFT is 1.9e-10 before the reduction
 * and 6.7e-12 after. Past `k^2 = 2^53` the product is not exact, so the angle is used as it is.
 */
function chirpAngle(sign: f64, k: i32, n: i32): f64 {
  const kk: f64 = k * k;
  const reduced: f64 = kk <= Number.MAX_SAFE_INTEGER ? kk % (2 * n) : kk;
  return (sign * Math.PI * reduced) / n;
}

/**
 * Length-n DFT on flat buffers. Power-of-two lengths use the radix-2 core.
 * Every other length uses Bluestein's algorithm (chirp-z) so the result is the
 * same transform as NumPy `np.fft.fft` / `np.fft.ifft`, not a zero-padded radix-2.
 *
 * `inverse` applies the 1/n scale. n = 0 returns empty buffers. n = 1 is the input.
 */
export function fftExactFloat64(
  realIn: Float64Array,
  imagIn: Float64Array,
  inverse: boolean = false
): { real: Float64Array; imag: Float64Array } {
  const n: i32 = realIn.length;
  if (n === 0) return { real: new Float64Array(0), imag: new Float64Array(0) };
  if (n === 1) {
    const real = new Float64Array([realIn[0] ?? 0]);
    const imag = new Float64Array([imagIn[0] ?? 0]);
    return { real, imag };
  }
  if (n > 0 && (n & (n - 1)) === 0) return fftCoreFloat64(realIn, imagIn, inverse);

  const sign: f64 = inverse ? 1 : -1;
  const convLen: i32 = nextPow2AtLeast(2 * n - 1);
  const yRe = new Float64Array(convLen);
  const yIm = new Float64Array(convLen);
  const hRe = new Float64Array(convLen);
  const hIm = new Float64Array(convLen);

  for (let k: i32 = 0; k < n; k++) {
    const ang: f64 = chirpAngle(sign, k, n);
    const cRe: f64 = Math.cos(ang);
    const cIm: f64 = Math.sin(ang);
    const xRe: f64 = realIn[k] ?? 0;
    const xIm: f64 = imagIn[k] ?? 0;
    // y = x * chirp, h = conj(chirp). kn = (k² + n² - (k-n)²) / 2.
    yRe[k] = xRe * cRe - xIm * cIm;
    yIm[k] = xRe * cIm + xIm * cRe;
    hRe[k] = cRe;
    hIm[k] = -cIm;
    if (k > 0) {
      hRe[convLen - k] = cRe;
      hIm[convLen - k] = -cIm;
    }
  }

  const Y = fftCoreFloat64(yRe, yIm, false);
  const H = fftCoreFloat64(hRe, hIm, false);
  const prodRe = new Float64Array(convLen);
  const prodIm = new Float64Array(convLen);
  for (let i: i32 = 0; i < convLen; i++) {
    prodRe[i] = Y.real[i]! * H.real[i]! - Y.imag[i]! * H.imag[i]!;
    prodIm[i] = Y.real[i]! * H.imag[i]! + Y.imag[i]! * H.real[i]!;
  }
  const conv = fftCoreFloat64(prodRe, prodIm, true);

  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  const scale: f64 = inverse ? 1 / n : 1;
  for (let k: i32 = 0; k < n; k++) {
    const ang: f64 = chirpAngle(sign, k, n);
    const cRe: f64 = Math.cos(ang);
    const cIm: f64 = Math.sin(ang);
    const re: f64 = conv.real[k]! * cRe - conv.imag[k]! * cIm;
    const im: f64 = conv.real[k]! * cIm + conv.imag[k]! * cRe;
    real[k] = re * scale;
    imag[k] = im * scale;
  }
  return { real, imag };
}
