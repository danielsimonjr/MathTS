/**
 * WASM dispatch bridge for spectral signal kernels — Slice 5.6.
 *
 * Kernels covered:
 *   - `apply_window_f64`       — in-place window multiplication
 *   - `welch_psd_f64`          — Welch's overlapped-segment-averaging PSD
 *   - `bartlett_psd_f64`       — Bartlett's non-overlapped segment-averaging PSD
 *   - `goertzel_f64`           — Goertzel single-bin DFT (returns |X[k]|²)
 *   - `chirp_z_transform_f64`  — Bluestein chirp-Z transform
 *
 * Dispatch (for arrays ≥ WASM_SIGNAL_THRESHOLD = 4096 samples):
 *   1. AS managed kernel (the binary the functions package bundles).
 *   2. Fall back to pure-JS implementation.
 *
 * The legacy native-pointer path was removed from this bridge in the
 * migration Phase 5 functions cutover.
 *
 * Window-type encoding:
 *   0 = Hann, 1 = Hamming, 2 = Blackman, 3 = Rectangular (no-op)
 *
 * Any thrown error is swallowed and the JS fallback runs — the WASM tier
 * is an optimisation, not a correctness requirement.
 */

import {
  getWasm,
  isAsWasm,
  withAsF64,
  asReadReturnedF64,
  type RawWasm,
} from '../bridges/common.js';

// ---------------------------------------------------------------------------
// Threshold
// ---------------------------------------------------------------------------

/** Minimum sample count for WASM acceleration. */
export const WASM_SIGNAL_THRESHOLD = 4096;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map string window name → integer type code. */
function windowTypeCode(name: string): number {
  switch (name) {
    case 'hann':
    case 'hanning':
      return 0;
    case 'hamming':
      return 1;
    case 'blackman':
      return 2;
    case 'rectangular':
    case 'rect':
    default:
      return 3;
  }
}

// ---------------------------------------------------------------------------
// Pure-JS fallback implementations
// ---------------------------------------------------------------------------

/** JS fallback: apply a window to `samples` in-place. */
export function applyWindowJS(samples: Float64Array, windowType: number): void {
  const n = samples.length;
  if (n === 0) return;
  const N1 = n - 1;
  switch (windowType) {
    case 0: // Hann
      for (let i = 0; i < n; i++) {
        samples[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / N1));
      }
      break;
    case 1: // Hamming
      for (let i = 0; i < n; i++) {
        samples[i] *= 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / N1);
      }
      break;
    case 2: // Blackman
      for (let i = 0; i < n; i++) {
        samples[i] *=
          0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N1) + 0.08 * Math.cos((4 * Math.PI * i) / N1);
      }
      break;
    // Rectangular (3 or default): no-op
  }
}

/** JS fallback: Goertzel algorithm, returns |X[k]|² at `targetFreq`. */
export function goertzelJS(samples: Float64Array, targetFreq: number, sampleRate: number): number {
  const n = samples.length;
  if (n === 0 || sampleRate <= 0) return NaN;
  const k = (targetFreq * n) / sampleRate;
  const omega = (2 * Math.PI * k) / n;
  const coeff = 2 * Math.cos(omega);
  let sPrev2 = 0;
  let sPrev1 = 0;
  for (let i = 0; i < n; i++) {
    const s = samples[i] + coeff * sPrev1 - sPrev2;
    sPrev2 = sPrev1;
    sPrev1 = s;
  }
  return sPrev2 * sPrev2 + sPrev1 * sPrev1 - coeff * sPrev1 * sPrev2;
}

/** Radix-2 FFT on interleaved complex array (re0,im0,...). n must be power of 2. */
function _fftInterleavedJS(data: Float64Array, n: number, inverse: boolean): void {
  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tmp = data[i * 2];
      data[i * 2] = data[j * 2];
      data[j * 2] = tmp;
      tmp = data[i * 2 + 1];
      data[i * 2 + 1] = data[j * 2 + 1];
      data[j * 2 + 1] = tmp;
    }
  }
  const sign = inverse ? 1 : -1;
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angle = (sign * 2 * Math.PI) / size;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let tRe = 1;
      let tIm = 0;
      for (let k = 0; k < halfSize; k++) {
        const eIdx = (start + k) * 2;
        const oIdx = (start + k + halfSize) * 2;
        const eRe = data[eIdx];
        const eIm = data[eIdx + 1];
        const oRe = data[oIdx];
        const oIm = data[oIdx + 1];
        const uRe = oRe * tRe - oIm * tIm;
        const uIm = oRe * tIm + oIm * tRe;
        data[eIdx] = eRe + uRe;
        data[eIdx + 1] = eIm + uIm;
        data[oIdx] = eRe - uRe;
        data[oIdx + 1] = eIm - uIm;
        const nextTRe = tRe * wRe - tIm * wIm;
        const nextTIm = tRe * wIm + tIm * wRe;
        tRe = nextTRe;
        tIm = nextTIm;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n * 2; i++) data[i] /= n;
  }
}

function _nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** JS fallback: Welch's PSD. */
export function welchPSDJS(
  samples: Float64Array,
  frameLength: number,
  overlap: number,
  windowType: number
): Float64Array {
  const n = samples.length;
  if (n < frameLength || frameLength < 2 || overlap >= frameLength) return new Float64Array(0);

  const psdLen = Math.floor(frameLength / 2) + 1;
  const psd = new Float64Array(psdLen);
  const hop = frameLength - overlap;
  const fftLen = _nextPow2(frameLength);

  // Window coefficients
  const win = new Float64Array(frameLength);
  win.fill(1.0);
  applyWindowJS(win, windowType);
  let winPower = 0;
  for (let i = 0; i < frameLength; i++) winPower += win[i] * win[i];
  winPower /= frameLength;

  let numFrames = 0;
  let start = 0;
  const fftData = new Float64Array(fftLen * 2);

  while (start + frameLength <= n) {
    fftData.fill(0);
    for (let i = 0; i < frameLength; i++) {
      fftData[i * 2] = samples[start + i] * win[i];
    }
    _fftInterleavedJS(fftData, fftLen, false);
    for (let k = 0; k < psdLen; k++) {
      const re = fftData[k * 2];
      const im = fftData[k * 2 + 1];
      psd[k] += re * re + im * im;
    }
    numFrames++;
    start += hop;
  }

  if (numFrames === 0) return new Float64Array(0);

  const norm = numFrames * frameLength * winPower;
  for (let k = 0; k < psdLen; k++) psd[k] /= norm;
  // Double one-sided bins
  for (let k = 1; k < psdLen - 1; k++) psd[k] *= 2;
  return psd;
}

/** JS fallback: Bartlett's PSD (Welch with rectangular window, overlap=0). */
export function bartlettPSDJS(samples: Float64Array, frameLength: number): Float64Array {
  return welchPSDJS(samples, frameLength, 0, 3);
}

/** JS fallback: Chirp-Z Transform (Bluestein). */
export function chirpZTransformJS(
  samples: Float64Array,
  m: number,
  phiStartRe: number,
  phiStartIm: number,
  phiStepRe: number,
  phiStepIm: number
): { re: Float64Array; im: Float64Array } {
  const n = samples.length;
  if (n === 0 || m === 0) {
    return { re: new Float64Array(0), im: new Float64Array(0) };
  }

  const lMin = n + m - 1;
  const l = _nextPow2(lMin);
  const argW = Math.atan2(phiStepIm, phiStepRe);

  // Build yn
  const yn = new Float64Array(l * 2);
  const aNormSq = phiStartRe * phiStartRe + phiStartIm * phiStartIm;
  const aInvRe = aNormSq > 1e-300 ? phiStartRe / aNormSq : 0;
  const aInvIm = aNormSq > 1e-300 ? -phiStartIm / aNormSq : 0;
  let aPowRe = 1;
  let aPowIm = 0;

  for (let i = 0; i < n; i++) {
    const phase = argW * i * i * 0.5;
    const wHalfRe = Math.cos(phase);
    const wHalfIm = Math.sin(phase);
    const tmpRe = aPowRe * wHalfRe - aPowIm * wHalfIm;
    const tmpIm = aPowRe * wHalfIm + aPowIm * wHalfRe;
    yn[i * 2] = samples[i] * tmpRe;
    yn[i * 2 + 1] = samples[i] * tmpIm;
    const newARe = aPowRe * aInvRe - aPowIm * aInvIm;
    const newAIm = aPowRe * aInvIm + aPowIm * aInvRe;
    aPowRe = newARe;
    aPowIm = newAIm;
  }

  // Build hn
  const hn = new Float64Array(l * 2);
  for (let i = 0; i < m; i++) {
    const phase = -argW * i * i * 0.5;
    hn[i * 2] = Math.cos(phase);
    hn[i * 2 + 1] = Math.sin(phase);
  }
  for (let i = 1; i < n; i++) {
    const phase = -argW * i * i * 0.5;
    hn[(l - i) * 2] = Math.cos(phase);
    hn[(l - i) * 2 + 1] = Math.sin(phase);
  }

  _fftInterleavedJS(yn, l, false);
  _fftInterleavedJS(hn, l, false);

  const gz = new Float64Array(l * 2);
  for (let i = 0; i < l; i++) {
    gz[i * 2] = yn[i * 2] * hn[i * 2] - yn[i * 2 + 1] * hn[i * 2 + 1];
    gz[i * 2 + 1] = yn[i * 2] * hn[i * 2 + 1] + yn[i * 2 + 1] * hn[i * 2];
  }
  _fftInterleavedJS(gz, l, true);

  const outRe = new Float64Array(m);
  const outIm = new Float64Array(m);
  for (let k = 0; k < m; k++) {
    const phase = argW * k * k * 0.5;
    const wHalfRe = Math.cos(phase);
    const wHalfIm = Math.sin(phase);
    outRe[k] = gz[k * 2] * wHalfRe - gz[k * 2 + 1] * wHalfIm;
    outIm[k] = gz[k * 2] * wHalfIm + gz[k * 2 + 1] * wHalfRe;
  }
  return { re: outRe, im: outIm };
}

// ---------------------------------------------------------------------------
// WASM-dispatched public API
// ---------------------------------------------------------------------------

/**
 * Apply a window function to `samples` in-place.
 * Always runs (no threshold — small arrays benefit too).
 */
export function applyWindowDispatch(samples: Float64Array, windowName: string): void {
  const wt = windowTypeCode(windowName);
  const wasm = getWasm() as unknown as RawWasm | null;
  if (wasm && isAsWasm(wasm)) {
    try {
      // AS managed ABI: apply_window_f64(samples, wt) modifies the buffer in
      // place; read it back from the same header and copy into `samples`.
      const out = withAsF64(wasm, [samples], (mod, [h]) => {
        (mod['apply_window_f64'] as (a: number, b: number) => number)(h, wt);
        return asReadReturnedF64(mod, h);
      });
      if (out && out.length === samples.length) {
        samples.set(out);
        return;
      }
    } catch {
      // fall through
    }
  }
  applyWindowJS(samples, wt);
}

/**
 * Welch's PSD with WASM acceleration above threshold.
 */
export function welchPSDDispatch(
  samples: Float64Array,
  frameLength: number,
  overlap: number,
  windowName: string
): Float64Array {
  const n = samples.length;
  const wt = windowTypeCode(windowName);

  if (n >= WASM_SIGNAL_THRESHOLD && n >= frameLength) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: welch_psd_f64(samples, frameLength, overlap, wt) -> Float64Array.
        const out = withAsF64(wasm, [samples], (mod, [h]) =>
          asReadReturnedF64(
            mod,
            (mod['welch_psd_f64'] as (s: number, fl: number, ov: number, wt: number) => number)(
              h,
              frameLength,
              overlap,
              wt
            )
          )
        );
        if (out && out.length > 0) return out;
      } catch {
        // fall through
      }
    }
  }
  return welchPSDJS(samples, frameLength, overlap, wt);
}

/**
 * Bartlett's PSD with WASM acceleration above threshold.
 */
export function bartlettPSDDispatch(samples: Float64Array, frameLength: number): Float64Array {
  const n = samples.length;

  if (n >= WASM_SIGNAL_THRESHOLD && n >= frameLength) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: bartlett_psd_f64(samples, frameLength) -> Float64Array.
        const out = withAsF64(wasm, [samples], (mod, [h]) =>
          asReadReturnedF64(
            mod,
            (mod['bartlett_psd_f64'] as (s: number, fl: number) => number)(h, frameLength)
          )
        );
        if (out && out.length > 0) return out;
      } catch {
        // fall through
      }
    }
  }
  return bartlettPSDJS(samples, frameLength);
}

/**
 * Goertzel single-bin DFT with WASM acceleration above threshold.
 */
export function goertzelDispatch(
  samples: Float64Array,
  targetFreq: number,
  sampleRate: number
): number {
  const n = samples.length;

  if (n >= WASM_SIGNAL_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: goertzel_f64(samples, targetFreq, sampleRate) -> f64.
        const r = withAsF64(wasm, [samples], (mod, [h]) =>
          (mod['goertzel_f64'] as (s: number, tf: number, sr: number) => number)(
            h,
            targetFreq,
            sampleRate
          )
        );
        if (r !== null) return r;
      } catch {
        // fall through
      }
    }
  }
  return goertzelJS(samples, targetFreq, sampleRate);
}

/**
 * Chirp-Z Transform with WASM acceleration above threshold.
 */
export function chirpZTransformDispatch(
  samples: Float64Array,
  m: number,
  phiStartRe: number,
  phiStartIm: number,
  phiStepRe: number,
  phiStepIm: number
): { re: Float64Array; im: Float64Array } {
  const n = samples.length;

  if (Math.max(n, m) >= WASM_SIGNAL_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: chirp_z_transform_f64(samples, m, ...) -> interleaved [re0, im0, …].
        const interleaved = withAsF64(wasm, [samples], (mod, [h]) =>
          asReadReturnedF64(
            mod,
            (
              mod['chirp_z_transform_f64'] as (
                s: number,
                m: number,
                psr: number,
                psi: number,
                pwr: number,
                pwi: number
              ) => number
            )(h, m, phiStartRe, phiStartIm, phiStepRe, phiStepIm)
          )
        );
        if (interleaved && interleaved.length === 2 * m) {
          const re = new Float64Array(m);
          const im = new Float64Array(m);
          for (let i = 0; i < m; i++) {
            re[i] = interleaved[i * 2];
            im[i] = interleaved[i * 2 + 1];
          }
          return { re, im };
        }
      } catch {
        // fall through
      }
    }
  }
  return chirpZTransformJS(samples, m, phiStartRe, phiStartIm, phiStepRe, phiStepIm);
}
