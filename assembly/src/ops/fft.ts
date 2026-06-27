/**
 * Fast Fourier Transform — radix-2 Cooley-Tukey, in-place on interleaved
 * complex data `[re0, im0, re1, im1, ...]`.
 *
 * AssemblyScript counterpart to the Rust `fft` / `rfft` / `powerSpectrum`
 * kernels (original Rust `signal/fft.rs`) and a line-for-
 * line match of the JS fallback `fftJS` in
 * `matrix/src/backends/wasm/fft-wasm.ts` (same bit-reversal, twiddle
 * recurrence, direction sign, and 1/n inverse scaling — so AS↔JS agreement is
 * at round-off level).
 *
 * ABI matches the existing matrix WASM consumer call shapes exactly:
 *   - `fft(dataPtr, n, inverse)`            in-place, `data` holds `2*n` f64
 *   - `rfft(dataPtr, n, resultPtr)`         real `n` in -> interleaved `2*n` out
 *   - `powerSpectrum(dataPtr, n, resultPtr)` interleaved `2*n` in -> `n` out
 *
 * **Size constraint: `n` must be a power of two** (same as `fftJS`; the matrix
 * JS layer rejects non-power-of-2 before reaching WASM). For a non-power-of-2
 * `n > 1` the data is left unchanged rather than corrupted. There is no
 * separate `ifft` export: the inverse transform is `fft(..., inverse=1)`.
 */

/** Power-of-two test. */
function isPow2(n: i32): bool {
  return n > 0 && (n & (n - 1)) == 0;
}

/**
 * In-place radix-2 FFT/IFFT on interleaved complex `data` of length `2*n`.
 * `inverse != 0` performs the inverse transform (with 1/n normalization).
 */
export function fft(data: Float64Array, n: i32, inverse: i32): void {
  if (n <= 1) return;
  if (!isPow2(n)) return; // power-of-2 only (matches fftJS / JS-layer guard)

  // Number of bits in the index (log2 n).
  let bits: i32 = 0;
  let tmp: i32 = n;
  while (tmp > 1) {
    tmp >>= 1;
    bits++;
  }

  // Bit-reversal permutation (swap each pair once, complex-wise).
  for (let i = 0; i < n; i++) {
    let j: i32 = 0;
    let x: i32 = i;
    for (let b = 0; b < bits; b++) {
      j = (j << 1) | (x & 1);
      x >>= 1;
    }
    if (j > i) {
      const ri = data[i * 2];
      const ii = data[i * 2 + 1];
      data[i * 2] = data[j * 2];
      data[i * 2 + 1] = data[j * 2 + 1];
      data[j * 2] = ri;
      data[j * 2 + 1] = ii;
    }
  }

  // Direction: -1 forward, +1 inverse.
  const direction: f64 = inverse != 0 ? 1.0 : -1.0;

  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size >> 1;
    const angle = (direction * 2.0 * Math.PI) / (size as f64);
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let start = 0; start < n; start += size) {
      let tRe: f64 = 1.0;
      let tIm: f64 = 0.0;

      for (let j = 0; j < halfSize; j++) {
        const evenIdx = (start + j) * 2;
        const oddIdx = (start + j + halfSize) * 2;

        const oRe = data[oddIdx];
        const oIm = data[oddIdx + 1];
        // Twiddle multiply.
        const uRe = oRe * tRe - oIm * tIm;
        const uIm = oRe * tIm + oIm * tRe;

        const eRe = data[evenIdx];
        const eIm = data[evenIdx + 1];

        data[evenIdx] = eRe + uRe;
        data[evenIdx + 1] = eIm + uIm;
        data[oddIdx] = eRe - uRe;
        data[oddIdx + 1] = eIm - uIm;

        // Advance twiddle factor.
        const nextTRe = tRe * wRe - tIm * wIm;
        const nextTIm = tRe * wIm + tIm * wRe;
        tRe = nextTRe;
        tIm = nextTIm;
      }
    }
  }

  if (inverse != 0) {
    const scale = 1.0 / (n as f64);
    const total = n * 2;
    for (let i = 0; i < total; i++) data[i] *= scale;
  }
}

/**
 * Real FFT: `n` real input values -> interleaved `2*n` complex output.
 * Writes the zero-imag complex form into `result`, then transforms in place.
 */
export function rfft(data: Float64Array, n: i32, result: Float64Array): void {
  for (let i = 0; i < n; i++) {
    result[i * 2] = data[i];
    result[i * 2 + 1] = 0.0;
  }
  fft(result, n, 0);
}

/**
 * Power spectrum |X[k]|^2 for interleaved complex `data` (`2*n`) -> `result` (`n`).
 */
export function powerSpectrum(data: Float64Array, n: i32, result: Float64Array): void {
  for (let i = 0; i < n; i++) {
    const re = data[i * 2];
    const im = data[i * 2 + 1];
    result[i] = re * re + im * im;
  }
}
