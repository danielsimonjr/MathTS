/**
 * Extra window functions (scipy.signal.windows parity).
 *
 * Every window takes `opts.sym` (default `true`, symmetric). `sym: false` builds
 * the periodic variant (length n+1, last sample dropped), as scipy does.
 *
 * @packageDocumentation
 */

import { windowFunction } from '../typed/signal.js';
import { besselIScalar } from '../wasm/special/scalars.js';

/** Window names accepted by {@link getWindow}. */
export type ExtraWindowName =
  | 'kaiser'
  | 'gaussian'
  | 'tukey'
  | 'blackmanharris'
  | 'nuttall'
  | 'flattop'
  | 'bohman'
  | 'parzen'
  | 'cosine'
  | 'exponential';

/** Options shared by the window constructors. */
export interface WindowOptions {
  /** Symmetric window (default `true`). `false` gives the periodic variant. */
  sym?: boolean;
}

/**
 * Run a window kernel over the effective length M and return the first n samples.
 * The periodic variant is built at M = n + 1 and truncated.
 */
function buildWindow(
  n: number,
  opts: WindowOptions | undefined,
  kernel: (M: number) => number[]
): number[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`window length must be a non-negative integer, got ${n}`);
  }
  if (n === 0) return [];
  const sym = opts?.sym ?? true;
  const M = sym || n <= 1 ? n : n + 1;
  if (M === 1) return [1];
  return kernel(M).slice(0, n);
}

/** Generalized cosine-sum window: sum_k (-1)^k a_k cos(2 pi k i / (M-1)). */
function cosineSum(M: number, a: readonly number[]): number[] {
  const out = new Array<number>(M);
  for (let i = 0; i < M; i++) {
    const x = (2 * Math.PI * i) / (M - 1);
    let s = 0;
    for (let k = 0; k < a.length; k++) {
      s += (k % 2 === 0 ? 1 : -1) * a[k] * Math.cos(k * x);
    }
    out[i] = s;
  }
  return out;
}

/**
 * Kaiser window with shape parameter beta (beta = 0 gives a rectangular window).
 *
 * @example
 * kaiserWindow(5, 0); // [1, 1, 1, 1, 1]
 */
export function kaiserWindow(n: number, beta: number, opts?: WindowOptions): number[] {
  return buildWindow(n, opts, (M) => {
    const alpha = (M - 1) / 2;
    const denom = besselIScalar(0, beta);
    const out = new Array<number>(M);
    for (let i = 0; i < M; i++) {
      const r = (i - alpha) / alpha;
      out[i] = besselIScalar(0, beta * Math.sqrt(Math.max(0, 1 - r * r))) / denom;
    }
    return out;
  });
}

/** Gaussian window with standard deviation `std` (in samples). */
export function gaussianWindow(n: number, std: number, opts?: WindowOptions): number[] {
  if (!(std > 0)) throw new RangeError(`gaussianWindow: std must be > 0, got ${std}`);
  return buildWindow(n, opts, (M) => {
    const alpha = (M - 1) / 2;
    const out = new Array<number>(M);
    for (let i = 0; i < M; i++) {
      const d = i - alpha;
      out[i] = Math.exp(-(d * d) / (2 * std * std));
    }
    return out;
  });
}

/**
 * Tukey (tapered cosine) window. alpha = 0 gives rectangular, alpha = 1 gives Hann.
 */
export function tukeyWindow(n: number, alpha: number = 0.5, opts?: WindowOptions): number[] {
  if (!(alpha >= 0 && alpha <= 1)) throw new RangeError(`tukeyWindow: alpha must be in [0, 1]`);
  return buildWindow(n, opts, (M) => {
    if (alpha <= 0) return new Array<number>(M).fill(1);
    if (alpha >= 1) {
      return Array.from({ length: M }, (_, i) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / (M - 1))));
    }
    const width = Math.floor((alpha * (M - 1)) / 2) + 1;
    const out = new Array<number>(M);
    for (let i = 0; i < M; i++) {
      if (i < width) {
        out[i] = 0.5 * (1 + Math.cos(Math.PI * (-1 + (2 * i) / (alpha * (M - 1)))));
      } else if (i >= M - width) {
        out[i] = 0.5 * (1 + Math.cos(Math.PI * (-2 / alpha + 1 + (2 * i) / (alpha * (M - 1)))));
      } else {
        out[i] = 1;
      }
    }
    return out;
  });
}

/** Blackman-Harris 4-term window (scipy coefficients). */
export function blackmanHarrisWindow(n: number, opts?: WindowOptions): number[] {
  return buildWindow(n, opts, (M) => cosineSum(M, [0.35875, 0.48829, 0.14128, 0.01168]));
}

/** Nuttall 4-term window. */
export function nuttallWindow(n: number, opts?: WindowOptions): number[] {
  return buildWindow(n, opts, (M) => cosineSum(M, [0.3635819, 0.4891775, 0.1365995, 0.0106411]));
}

/** Flat-top 5-term window (scipy coefficients). */
export function flattopWindow(n: number, opts?: WindowOptions): number[] {
  return buildWindow(n, opts, (M) =>
    cosineSum(M, [0.21557895, 0.41663158, 0.277263158, 0.083578947, 0.006947368])
  );
}

/** Bohman window (zero at both ends). */
export function bohmanWindow(n: number, opts?: WindowOptions): number[] {
  return buildWindow(n, opts, (M) => {
    const out = new Array<number>(M).fill(0);
    for (let i = 1; i < M - 1; i++) {
      const x = Math.abs(-1 + (2 * i) / (M - 1));
      out[i] = (1 - x) * Math.cos(Math.PI * x) + Math.sin(Math.PI * x) / Math.PI;
    }
    return out;
  });
}

/** Parzen window (piecewise cubic). */
export function parzenWindow(n: number, opts?: WindowOptions): number[] {
  return buildWindow(n, opts, (M) => {
    const half = M / 2;
    const quarter = (M - 1) / 4;
    const out = new Array<number>(M);
    for (let i = 0; i < M; i++) {
      const a = Math.abs(i - (M - 1) / 2);
      const r = a / half;
      out[i] = a > quarter ? 2 * (1 - r) ** 3 : 1 - 6 * r * r + 6 * r * r * r;
    }
    return out;
  });
}

/** Cosine (half-sine) window: sin(pi (i + 0.5) / M). */
export function cosineWindow(n: number, opts?: WindowOptions): number[] {
  return buildWindow(n, opts, (M) =>
    Array.from({ length: M }, (_, i) => Math.sin((Math.PI * (i + 0.5)) / M))
  );
}

/**
 * Exponential (two-sided) window exp(-|i - center| / tau), centred on (M-1)/2.
 */
export function exponentialWindow(n: number, tau: number, opts?: WindowOptions): number[] {
  if (!(tau > 0)) throw new RangeError(`exponentialWindow: tau must be > 0, got ${tau}`);
  return buildWindow(n, opts, (M) => {
    const center = (M - 1) / 2;
    return Array.from({ length: M }, (_, i) => Math.exp(-Math.abs(i - center) / tau));
  });
}

/**
 * Build a window by name. `param` is beta (kaiser, default 0), std (gaussian,
 * default 1), alpha (tukey, default 0.5) or tau (exponential, default 1). The
 * classic names (hamming, hann, blackman, bartlett, rectangular) delegate to
 * {@link windowFunction} and are always symmetric.
 */
export function getWindow(
  name: ExtraWindowName | 'hamming' | 'hann' | 'blackman' | 'bartlett' | 'rectangular',
  n: number,
  param?: number
): number[] {
  switch (name) {
    case 'kaiser':
      return kaiserWindow(n, param ?? 0);
    case 'gaussian':
      return gaussianWindow(n, param ?? 1);
    case 'tukey':
      return tukeyWindow(n, param ?? 0.5);
    case 'exponential':
      return exponentialWindow(n, param ?? 1);
    case 'blackmanharris':
      return blackmanHarrisWindow(n);
    case 'nuttall':
      return nuttallWindow(n);
    case 'flattop':
      return flattopWindow(n);
    case 'bohman':
      return bohmanWindow(n);
    case 'parzen':
      return parzenWindow(n);
    case 'cosine':
      return cosineWindow(n);
    case 'hamming':
    case 'hann':
    case 'blackman':
    case 'bartlett':
    case 'rectangular':
      return windowFunction(n, name);
    default:
      throw new Error(`getWindow: unknown window '${String(name)}'`);
  }
}
