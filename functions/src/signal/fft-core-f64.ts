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
