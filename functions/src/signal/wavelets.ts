/**
 * Phase 6 Task 4 — inverse DWT, multilevel wavedec/waverec (perfect
 * reconstruction), and the continuous wavelet transform (CWT).
 *
 * `idwt` inverts `dwt` (`../typed/signal.ts`) via the shared periodization
 * filter bank in `./wavelet-filters.ts`, which supports the full family list
 * (`SUPPORTED_WAVELETS`: haar, db1-4, sym2-4, coif1-2) and matches
 * `pywt.idwt(..., mode='periodization')` bit-for-bit. For Haar/db1 this is
 * verified equivalent to the earlier hardcoded closed-form 2-tap inverse
 * (`x[2i] = s*(approx[i]+detail[i])`, `x[2i+1] = s*(approx[i]-detail[i])`,
 * `s = 1/sqrt(2)`) — no behavior change for existing callers.
 *
 * @packageDocumentation
 */

import { dwt } from '../typed/signal.js';
import { idwtPeriodization } from './wavelet-filters.js';
import { convDirect } from './conv.js';

/**
 * Inverse single-level discrete wavelet transform (periodization boundary).
 * Exactly inverts `dwt` for every wavelet in `SUPPORTED_WAVELETS`
 * (`./wavelet-filters.ts`): haar, db1-4, sym2-4, coif1-2.
 *
 * @param approx - Approximation (low-pass) coefficients
 * @param detail - Detail (high-pass) coefficients, same length as `approx`
 * @param wavelet - Wavelet name (default 'haar'); see `SUPPORTED_WAVELETS`
 * @returns Reconstructed signal, length `2 * approx.length`
 */
export function idwt(approx: number[], detail: number[], wavelet: string = 'haar'): number[] {
  try {
    return idwtPeriodization(approx, detail, wavelet);
  } catch (err) {
    throw new Error(`idwt: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
}

/**
 * Multilevel discrete wavelet decomposition: repeatedly applies `dwt` to the
 * approximation coefficients.
 *
 * @param x - Input signal
 * @param wavelet - Wavelet name (passed through to `dwt`); see
 *   `SUPPORTED_WAVELETS` in `./wavelet-filters.ts`
 * @param level - Number of decomposition levels (>= 1)
 * @returns `[cA_level, cD_level, cD_{level-1}, ..., cD_1]` (pywt order)
 */
export function wavedec(x: number[], wavelet: string = 'haar', level: number = 1): number[][] {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error('wavedec: level must be an integer >= 1');
  }

  const coeffs: number[][] = [];
  let approx = x.slice();
  for (let l = 0; l < level; l++) {
    const { approx: a, detail: d } = dwt(approx, wavelet);
    coeffs.unshift(d);
    approx = a;
  }
  coeffs.unshift(approx);
  return coeffs;
}

/**
 * Inverse of `wavedec`: repeatedly applies `idwt` from the coarsest level
 * (`coeffs[0]` = cA_level) up to the finest detail (`coeffs[coeffs.length-1]`
 * = cD_1), reconstructing the original signal.
 *
 * @param coeffs - Coefficient arrays as returned by `wavedec`
 * @param wavelet - Wavelet name (passed through to `idwt`)
 * @returns Reconstructed signal
 */
export function waverec(coeffs: number[][], wavelet: string = 'haar'): number[] {
  if (coeffs.length < 2) {
    throw new Error('waverec: coeffs must contain at least [cA, cD]');
  }

  let approx = coeffs[0].slice();
  for (let i = 1; i < coeffs.length; i++) {
    approx = idwt(approx, coeffs[i], wavelet);
  }
  return approx;
}

/** Discretized, normalized Ricker (Mexican-hat) wavelet: `(1-t^2)e^(-t^2/2)`. */
function rickerWavelet(points: number, scale: number): number[] {
  const amplitude = 2 / (Math.sqrt(3 * scale) * Math.pow(Math.PI, 0.25));
  const out = new Array<number>(points);
  const center = (points - 1) / 2;
  for (let i = 0; i < points; i++) {
    const t = (i - center) / scale;
    const t2 = t * t;
    out[i] = amplitude * (1 - t2) * Math.exp(-t2 / 2);
  }
  return out;
}

/** Discretized, normalized real Morlet wavelet: `cos(5t)e^(-t^2/2)`. */
function morletWavelet(points: number, scale: number): number[] {
  const norm = 1 / (Math.sqrt(scale) * Math.pow(Math.PI, 0.25));
  const out = new Array<number>(points);
  const center = (points - 1) / 2;
  for (let i = 0; i < points; i++) {
    const t = (i - center) / scale;
    out[i] = norm * Math.cos(5 * t) * Math.exp(-(t * t) / 2);
  }
  return out;
}

/**
 * Continuous wavelet transform: convolves `x` with a discretized, normalized
 * wavelet at each requested scale.
 *
 * @param x - Input signal
 * @param scales - Wavelet scales to evaluate (each > 0)
 * @param wavelet - 'ricker' (Mexican-hat, default) or 'morlet'
 * @returns `scales.length` x `x.length` matrix, row `i` = CWT at `scales[i]`
 */
export function cwt(x: number[], scales: number[], wavelet: string = 'ricker'): number[][] {
  if (wavelet !== 'ricker' && wavelet !== 'morlet') {
    throw new Error(`cwt: unsupported wavelet "${wavelet}"`);
  }

  const n = x.length;
  return scales.map((scale) => {
    if (scale <= 0) throw new Error('cwt: scales must be positive');
    const points = Math.max(1, Math.min(Math.round(10 * scale), n));
    const psi = wavelet === 'ricker' ? rickerWavelet(points, scale) : morletWavelet(points, scale);
    return convDirect(x, psi, 'same');
  });
}
