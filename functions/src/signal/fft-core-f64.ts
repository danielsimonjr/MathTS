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

  // Direction factor
  const direction: f64 = inverse ? 1.0 : -1.0;

  // Butterfly operations
  for (let size: i32 = 2; size <= n; size *= 2) {
    const halfSize: i32 = size / 2;
    const angle: f64 = (direction * 2.0 * Math.PI) / size;
    const wRe: f64 = Math.cos(angle);
    const wIm: f64 = Math.sin(angle);

    for (let start: i32 = 0; start < n; start += size) {
      let tRe: f64 = 1.0;
      let tIm: f64 = 0.0;

      for (let j: i32 = 0; j < halfSize; j++) {
        const evenIdx: i32 = start + j;
        const oddIdx: i32 = start + j + halfSize;

        // Twiddle factor multiplication
        const uRe: f64 = real[oddIdx] * tRe - imag[oddIdx] * tIm;
        const uIm: f64 = real[oddIdx] * tIm + imag[oddIdx] * tRe;

        // Butterfly
        const eRe: f64 = real[evenIdx];
        const eIm: f64 = imag[evenIdx];

        real[evenIdx] = eRe + uRe;
        imag[evenIdx] = eIm + uIm;
        real[oddIdx] = eRe - uRe;
        imag[oddIdx] = eIm - uIm;

        // Update twiddle factor
        const nextTRe: f64 = tRe * wRe - tIm * wIm;
        const nextTIm: f64 = tRe * wIm + tIm * wRe;
        tRe = nextTRe;
        tIm = nextTIm;
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
    const ang: f64 = (sign * Math.PI * k * k) / n;
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
    const ang: f64 = (sign * Math.PI * k * k) / n;
    const cRe: f64 = Math.cos(ang);
    const cIm: f64 = Math.sin(ang);
    const re: f64 = conv.real[k]! * cRe - conv.imag[k]! * cIm;
    const im: f64 = conv.real[k]! * cIm + conv.imag[k]! * cRe;
    real[k] = re * scale;
    imag[k] = im * scale;
  }
  return { real, imag };
}
