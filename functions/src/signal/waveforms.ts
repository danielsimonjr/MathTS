/**
 * Test waveform generators (scipy.signal.waveforms parity).
 *
 * Phase offsets `phi` are in radians (scipy takes degrees for chirp/sweep_poly).
 *
 * @packageDocumentation
 */

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));
const TWO_PI = 2 * Math.PI;

/** Frequency sweep method for {@link chirp}. */
export type ChirpMethod = 'linear' | 'quadratic' | 'logarithmic' | 'hyperbolic';

/** Options for {@link chirp}. */
export interface ChirpOptions {
  /** Sweep law (default `'linear'`). */
  method?: ChirpMethod;
  /** Phase offset in radians (default 0). */
  phi?: number;
}

/**
 * Cosine chirp sweeping from f0 at t = 0 to f1 at t = t1 (frequencies in Hz).
 *
 * @example
 * chirp([0], 1, 1, 10); // [1]
 */
export function chirp(t: Vec, f0: number, t1: number, f1: number, opts?: ChirpOptions): number[] {
  if (!(t1 > 0)) throw new RangeError(`chirp: t1 must be > 0, got ${t1}`);
  const method = opts?.method ?? 'linear';
  const phi = opts?.phi ?? 0;
  const cyclesAt = cyclePhase(method, f0, t1, f1);
  return arr(t).map((x) => Math.cos(TWO_PI * cyclesAt(x) + phi));
}

/** Integrated phase in cycles, f(t) being the instantaneous frequency. */
function cyclePhase(
  method: ChirpMethod,
  f0: number,
  t1: number,
  f1: number
): (x: number) => number {
  switch (method) {
    case 'linear': {
      const k = (f1 - f0) / (2 * t1);
      return (x) => f0 * x + k * x * x;
    }
    case 'quadratic': {
      const beta = (f1 - f0) / (t1 * t1);
      return (x) => f0 * x + (beta * x * x * x) / 3;
    }
    case 'logarithmic': {
      if (f0 === 0 || f1 === 0 || Math.sign(f0) !== Math.sign(f1)) {
        throw new RangeError('chirp: logarithmic sweep needs non-zero f0, f1 of the same sign');
      }
      if (f0 === f1) return (x) => f0 * x;
      const lnk = Math.log(f1 / f0);
      return (x) => (f0 * t1 * (Math.exp((x / t1) * lnk) - 1)) / lnk;
    }
    case 'hyperbolic': {
      if (f0 === f1) return (x) => f0 * x;
      if (f0 === 0 || f1 === 0) {
        throw new RangeError('chirp: hyperbolic sweep needs non-zero f0 and f1');
      }
      const c = (f0 * f1 * t1) / (f0 - f1);
      return (x) => c * Math.log(((f0 - f1) * x + f1 * t1) / (f1 * t1));
    }
    default:
      throw new Error(`chirp: unknown method '${String(method)}'`);
  }
}

/**
 * Square wave: +1 while frac(t / 2 pi) < duty, otherwise -1.
 */
export function squareWave(t: Vec, duty: number = 0.5): number[] {
  if (!(duty >= 0 && duty <= 1)) throw new RangeError('squareWave: duty must be in [0, 1]');
  return arr(t).map((x) => {
    const x2 = x / TWO_PI;
    return x2 - Math.floor(x2) < duty ? 1 : -1;
  });
}

/**
 * Sawtooth wave: -1 at phase 0 rising to +1 at phase 2 pi * width, then falling
 * back. `width = 1` is a rising ramp; `width = 0.5` is a triangle.
 */
export function sawtooth(t: Vec, width: number = 1): number[] {
  if (!(width >= 0 && width <= 1)) throw new RangeError('sawtooth: width must be in [0, 1]');
  return arr(t).map((x) => {
    const tm = x - TWO_PI * Math.floor(x / TWO_PI);
    if (tm < width * TWO_PI) return tm / (Math.PI * width) - 1;
    return (Math.PI * (1 + width) - tm) / (Math.PI * (1 - width));
  });
}

/**
 * Gaussian-modulated cosine pulse.
 *
 * @param fc - Centre frequency (Hz)
 * @param bw - Fractional bandwidth (default 0.5)
 * @param bwr - Reference level in dB for the bandwidth (default -6)
 */
export function gaussPulse(t: Vec, fc: number, bw: number = 0.5, bwr: number = -6): number[] {
  const ref = Math.pow(10, bwr / 20);
  const a = -((Math.PI * fc * bw) ** 2) / (4 * Math.log(ref));
  return arr(t).map((x) => Math.exp(-a * x * x) * Math.cos(TWO_PI * fc * x));
}

/**
 * Discrete unit impulse of length n. `idx` defaults to 0, `'mid'` is floor(n / 2).
 */
export function unitImpulse(n: number, idx: number | 'mid' = 0): number[] {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`unitImpulse: invalid length ${n}`);
  const pos = idx === 'mid' ? Math.floor(n / 2) : idx;
  if (!Number.isInteger(pos) || pos < 0 || pos >= n) {
    throw new RangeError(`unitImpulse: index ${String(idx)} out of range for length ${n}`);
  }
  const out = new Array<number>(n).fill(0);
  out[pos] = 1;
  return out;
}

/**
 * Cosine with a polynomial instantaneous frequency f(t) = sum_k c_k t^(p-k) Hz.
 * `polyCoeffs` are highest-order first (numpy poly1d order).
 */
export function sweepPoly(t: Vec, polyCoeffs: readonly number[], phi: number = 0): number[] {
  if (polyCoeffs.length === 0) throw new RangeError('sweepPoly: polyCoeffs must be non-empty');
  const p = polyCoeffs.length - 1;
  return arr(t).map((x) => {
    let cycles = 0;
    for (let k = 0; k <= p; k++) {
      const power = p - k + 1;
      cycles += (polyCoeffs[k] * Math.pow(x, power)) / power;
    }
    return Math.cos(TWO_PI * cycles + phi);
  });
}
