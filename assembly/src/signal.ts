/**
 * Spectral-windowing WASM kernels — AssemblyScript parity port (Slice 5.6).
 *
 * Mirrors the algorithms in:
 *   wasm-rust/crates/mathts-wasm/src/signal/spectral.rs
 *
 * All exported functions use the typed-array calling convention.
 * Window-type encoding: 0=Hann, 1=Hamming, 2=Blackman, 3=Rectangular.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Apply a window function to `buf` in-place. */
function _applyWindowInplace(buf: Float64Array, windowType: i32): void {
  const n: i32 = buf.length;
  if (n == 0) return;
  const n1: f64 = <f64>(n - 1);
  for (let i: i32 = 0; i < n; i++) {
    const fi: f64 = <f64>i;
    if (windowType == 0) {
      // Hann
      buf[i] *= 0.5 * (1.0 - Math.cos((2.0 * Math.PI * fi) / n1));
    } else if (windowType == 1) {
      // Hamming
      buf[i] *= 0.54 - 0.46 * Math.cos((2.0 * Math.PI * fi) / n1);
    } else if (windowType == 2) {
      // Blackman
      buf[i] *=
        0.42 -
        0.5 * Math.cos((2.0 * Math.PI * fi) / n1) +
        0.08 * Math.cos((4.0 * Math.PI * fi) / n1);
    }
    // Rectangular (3 or default) — no-op
  }
}

/** Next power of 2 >= n. */
function _nextPow2(n: i32): i32 {
  let p: i32 = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Radix-2 Cooley-Tukey FFT on interleaved complex data (re0,im0,re1,im1,...).
 * `n` must be a power of 2.
 * `inverse` = false for forward, true for inverse (with 1/N scaling).
 */
function _fftInterleaved(data: Float64Array, n: i32, inverse: bool): void {
  // Bit-reversal permutation
  let j: i32 = 0;
  for (let i: i32 = 1; i < n; i++) {
    let bit: i32 = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      // Swap complex elements i and j
      const ri: f64 = data[i * 2];
      const ii: f64 = data[i * 2 + 1];
      data[i * 2] = data[j * 2];
      data[i * 2 + 1] = data[j * 2 + 1];
      data[j * 2] = ri;
      data[j * 2 + 1] = ii;
    }
  }

  const sign: f64 = inverse ? 1.0 : -1.0;
  let size: i32 = 2;
  while (size <= n) {
    const halfSize: i32 = size >> 1;
    const angle: f64 = (sign * 2.0 * Math.PI) / <f64>size;
    const wRe: f64 = Math.cos(angle);
    const wIm: f64 = Math.sin(angle);

    for (let start: i32 = 0; start < n; start += size) {
      let tRe: f64 = 1.0;
      let tIm: f64 = 0.0;
      for (let k: i32 = 0; k < halfSize; k++) {
        const eIdx: i32 = (start + k) * 2;
        const oIdx: i32 = (start + k + halfSize) * 2;
        const eRe: f64 = data[eIdx];
        const eIm: f64 = data[eIdx + 1];
        const oRe: f64 = data[oIdx];
        const oIm: f64 = data[oIdx + 1];
        const uRe: f64 = oRe * tRe - oIm * tIm;
        const uIm: f64 = oRe * tIm + oIm * tRe;
        data[eIdx] = eRe + uRe;
        data[eIdx + 1] = eIm + uIm;
        data[oIdx] = eRe - uRe;
        data[oIdx + 1] = eIm - uIm;
        const nextTRe: f64 = tRe * wRe - tIm * wIm;
        const nextTIm: f64 = tRe * wIm + tIm * wRe;
        tRe = nextTRe;
        tIm = nextTIm;
      }
    }
    size <<= 1;
  }

  if (inverse) {
    const scale: f64 = 1.0 / <f64>n;
    for (let i: i32 = 0; i < n * 2; i++) {
      data[i] *= scale;
    }
  }
}

// ---------------------------------------------------------------------------
// 1. apply_window_f64
// ---------------------------------------------------------------------------

/**
 * Apply a window function to `samples` in-place.
 *
 * @param samples - Input/output samples (modified in-place)
 * @param windowType - 0=Hann, 1=Hamming, 2=Blackman, 3=Rectangular
 * @returns 0 on success, -1 on error
 */
export function apply_window_f64(samples: Float64Array, windowType: i32): i32 {
  if (samples.length == 0) return -1;
  _applyWindowInplace(samples, windowType);
  return 0;
}

// ---------------------------------------------------------------------------
// 2. welch_psd_f64
// ---------------------------------------------------------------------------

/**
 * Welch's overlapped-segment-averaging PSD.
 *
 * @param samples - Input signal
 * @param frameLength - Length of each frame (should be a power of 2)
 * @param overlap - Number of overlapping samples between consecutive frames
 * @param windowType - Window function (0=Hann, 1=Hamming, 2=Blackman, 3=Rect)
 * @returns Float64Array of length frameLength/2 + 1, or empty on error
 */
export function welch_psd_f64(
  samples: Float64Array,
  frameLength: i32,
  overlap: i32,
  windowType: i32,
): Float64Array {
  const n: i32 = samples.length;
  if (n < frameLength || frameLength < 2 || overlap >= frameLength) {
    return new Float64Array(0);
  }

  const psdLen: i32 = frameLength / 2 + 1;
  const psd = new Float64Array(psdLen);
  const hop: i32 = frameLength - overlap;

  // Window normalization
  const winBuf = new Float64Array(frameLength);
  for (let i: i32 = 0; i < frameLength; i++) winBuf[i] = 1.0;
  _applyWindowInplace(winBuf, windowType);
  let winPower: f64 = 0.0;
  for (let i: i32 = 0; i < frameLength; i++) winPower += winBuf[i] * winBuf[i];
  winPower /= <f64>frameLength;

  let numFrames: i32 = 0;
  let start: i32 = 0;

  // Use next power-of-2 >= frameLength for FFT
  const fftLen: i32 = _nextPow2(frameLength);
  const fftData = new Float64Array(fftLen * 2); // interleaved complex

  while (start + frameLength <= n) {
    // Zero the FFT buffer
    for (let i: i32 = 0; i < fftLen * 2; i++) fftData[i] = 0.0;

    // Copy frame and apply window
    for (let i: i32 = 0; i < frameLength; i++) {
      fftData[i * 2] = samples[start + i] * winBuf[i];
      fftData[i * 2 + 1] = 0.0;
    }

    _fftInterleaved(fftData, fftLen, false);

    // Accumulate |X[k]|²  (only first fftLen/2+1 bins; psdLen uses frameLength)
    for (let k: i32 = 0; k < psdLen; k++) {
      const re: f64 = fftData[k * 2];
      const im: f64 = fftData[k * 2 + 1];
      psd[k] += re * re + im * im;
    }

    numFrames++;
    start += hop;
  }

  if (numFrames == 0) return new Float64Array(0);

  const norm: f64 = <f64>numFrames * <f64>frameLength * winPower;
  for (let k: i32 = 0; k < psdLen; k++) {
    psd[k] /= norm;
  }
  // Double one-sided bins (except DC and Nyquist)
  for (let k: i32 = 1; k < psdLen - 1; k++) {
    psd[k] *= 2.0;
  }

  return psd;
}

// ---------------------------------------------------------------------------
// 3. bartlett_psd_f64
// ---------------------------------------------------------------------------

/**
 * Bartlett's non-overlapped segment-averaging PSD (Welch with overlap=0).
 *
 * @param samples - Input signal
 * @param frameLength - Length of each frame
 * @returns Float64Array of length frameLength/2 + 1, or empty on error
 */
export function bartlett_psd_f64(samples: Float64Array, frameLength: i32): Float64Array {
  return welch_psd_f64(samples, frameLength, 0, 3); // rectangular, no overlap
}

// ---------------------------------------------------------------------------
// 4. goertzel_f64
// ---------------------------------------------------------------------------

/**
 * Goertzel algorithm: compute |X[k]|² for a single DFT bin.
 *
 * @param samples - Input signal
 * @param targetFreq - Target frequency in Hz
 * @param sampleRate - Sample rate in Hz
 * @returns |X[k]|² (power at target frequency), or NaN on error
 */
export function goertzel_f64(samples: Float64Array, targetFreq: f64, sampleRate: f64): f64 {
  const n: i32 = samples.length;
  if (n == 0 || sampleRate <= 0.0) return NaN;

  const kf: f64 = (targetFreq * <f64>n) / sampleRate;
  const omega: f64 = (2.0 * Math.PI * kf) / <f64>n;
  const cosOmega: f64 = Math.cos(omega);
  const coeff: f64 = 2.0 * cosOmega;

  let sPrev2: f64 = 0.0;
  let sPrev1: f64 = 0.0;

  for (let i: i32 = 0; i < n; i++) {
    const s: f64 = samples[i] + coeff * sPrev1 - sPrev2;
    sPrev2 = sPrev1;
    sPrev1 = s;
  }

  return sPrev2 * sPrev2 + sPrev1 * sPrev1 - coeff * sPrev1 * sPrev2;
}

// ---------------------------------------------------------------------------
// 5. chirp_z_transform_f64
// ---------------------------------------------------------------------------

/**
 * Chirp-Z Transform (Bluestein algorithm).
 *
 * Returns an interleaved Float64Array [re0, im0, re1, im1, ...] of length 2*M.
 * Returns empty array on error.
 *
 * @param samples - Input real signal of length N
 * @param m - Number of output points
 * @param phiStartRe - Real part of starting complex exponential A
 * @param phiStartIm - Imaginary part of A
 * @param phiStepRe - Real part of step complex exponential W
 * @param phiStepIm - Imaginary part of W
 */
export function chirp_z_transform_f64(
  samples: Float64Array,
  m: i32,
  phiStartRe: f64,
  phiStartIm: f64,
  phiStepRe: f64,
  phiStepIm: f64,
): Float64Array {
  const n: i32 = samples.length;
  if (n == 0 || m == 0) return new Float64Array(0);

  // L = next power of 2 >= N+M-1
  const lMin: i32 = n + m - 1;
  const l: i32 = _nextPow2(lMin);

  // arg(W) — the angle of the step complex number
  const argW: f64 = Math.atan2(phiStepIm, phiStepRe);

  // Build yn: length L (zero-padded after N), interleaved complex
  const yn = new Float64Array(l * 2);
  // A^{-n}: A_inv = conj(A) / |A|²
  const aNormSq: f64 = phiStartRe * phiStartRe + phiStartIm * phiStartIm;
  let aInvRe: f64 = aNormSq > 1e-300 ? phiStartRe / aNormSq : 0.0;
  let aInvIm: f64 = aNormSq > 1e-300 ? -phiStartIm / aNormSq : 0.0;
  let aPowRe: f64 = 1.0; // A^{-n}
  let aPowIm: f64 = 0.0;

  for (let i: i32 = 0; i < n; i++) {
    const iFlt: f64 = <f64>i;
    const phase: f64 = argW * iFlt * iFlt * 0.5;
    const wHalfRe: f64 = Math.cos(phase);
    const wHalfIm: f64 = Math.sin(phase);
    // yn[i] = x[i] * aPow * wHalf
    const tmpRe: f64 = aPowRe * wHalfRe - aPowIm * wHalfIm;
    const tmpIm: f64 = aPowRe * wHalfIm + aPowIm * wHalfRe;
    yn[i * 2] = samples[i] * tmpRe;
    yn[i * 2 + 1] = samples[i] * tmpIm;
    // Advance A^{-n}: multiply by A^{-1}
    const newARe: f64 = aPowRe * aInvRe - aPowIm * aInvIm;
    const newAIm: f64 = aPowRe * aInvIm + aPowIm * aInvRe;
    aPowRe = newARe;
    aPowIm = newAIm;
  }

  // Build hn (chirp filter): h[i] = W^{-i²/2} for i in 0..M-1
  //                          h[L-i] = W^{-i²/2} for i in 1..N-1
  const hn = new Float64Array(l * 2);
  for (let i: i32 = 0; i < m; i++) {
    const phase: f64 = -argW * <f64>i * <f64>i * 0.5;
    hn[i * 2] = Math.cos(phase);
    hn[i * 2 + 1] = Math.sin(phase);
  }
  for (let i: i32 = 1; i < n; i++) {
    const phase: f64 = -argW * <f64>i * <f64>i * 0.5;
    hn[(l - i) * 2] = Math.cos(phase);
    hn[(l - i) * 2 + 1] = Math.sin(phase);
  }

  // FFT(yn), FFT(hn), pointwise multiply, IFFT
  _fftInterleaved(yn, l, false);
  _fftInterleaved(hn, l, false);

  // gz = yn * hn (pointwise complex multiply)
  const gz = new Float64Array(l * 2);
  for (let i: i32 = 0; i < l; i++) {
    const re: f64 = yn[i * 2] * hn[i * 2] - yn[i * 2 + 1] * hn[i * 2 + 1];
    const im: f64 = yn[i * 2] * hn[i * 2 + 1] + yn[i * 2 + 1] * hn[i * 2];
    gz[i * 2] = re;
    gz[i * 2 + 1] = im;
  }

  // IFFT already scales by 1/L
  _fftInterleaved(gz, l, true);

  // Extract M output points and multiply by W^{k²/2}
  const out = new Float64Array(m * 2);
  for (let k: i32 = 0; k < m; k++) {
    const kFlt: f64 = <f64>k;
    const phase: f64 = argW * kFlt * kFlt * 0.5;
    const wHalfRe: f64 = Math.cos(phase);
    const wHalfIm: f64 = Math.sin(phase);
    const gRe: f64 = gz[k * 2];
    const gIm: f64 = gz[k * 2 + 1];
    out[k * 2] = gRe * wHalfRe - gIm * wHalfIm;
    out[k * 2 + 1] = gRe * wHalfIm + gIm * wHalfRe;
  }

  return out;
}
