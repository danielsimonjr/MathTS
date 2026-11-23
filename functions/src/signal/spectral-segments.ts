import { assertAllocSize } from '../utils/limits.js';

/** Window and detrending rules for Welch and cross-spectrum estimates. */
export interface SpectralSegmentOptions {
  /** Detrend each segment by subtracting its mean (default), or pass false to keep its mean. */
  detrend?: 'constant' | false;
  /** Use a DFT-periodic window (default), or pass false for a symmetric window. */
  periodic?: boolean;
}

/** The constant removed from one segment before applying its window. */
export function segmentOffset(
  signal: ArrayLike<number>,
  start: number,
  count: number,
  detrend: 'constant' | false
): number {
  if (detrend === false) return 0;
  let total = 0;
  for (let i = 0; i < count; i++) total += signal[start + i];
  return total / count;
}

/** Construct a window using the symmetric or periodic denominator. */
export function windowFunctionCore(n: number, type: string, periodic = false): number[] {
  assertAllocSize('windowFunction', [n]);
  const w: number[] = new Array(n);
  const N1 = periodic ? n : n - 1;
  if (n === 1) {
    if (type === 'bartlett') return [0];
    if (
      type === 'hamming' ||
      type === 'hann' ||
      type === 'hanning' ||
      type === 'blackman' ||
      type === 'rectangular' ||
      type === 'rect'
    ) {
      return [1];
    }
  }

  switch (type) {
    case 'hamming':
      for (let i = 0; i < n; i++) w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / N1);
      break;
    case 'hann':
    case 'hanning':
      for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / N1));
      break;
    case 'blackman':
      for (let i = 0; i < n; i++)
        w[i] =
          0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N1) + 0.08 * Math.cos((4 * Math.PI * i) / N1);
      break;
    case 'bartlett':
      for (let i = 0; i < n; i++) w[i] = 1 - Math.abs((2 * i - N1) / N1);
      break;
    case 'rectangular':
    case 'rect':
      for (let i = 0; i < n; i++) w[i] = 1;
      break;
    default:
      throw new Error(`windowFunction: unknown window type '${type}'`);
  }

  return w;
}
