/**
 * Lomb-Scargle periodogram for unevenly sampled data (classic Scargle form with
 * the tau time offset, as in scipy.signal.lombscargle).
 *
 * @packageDocumentation
 */

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

/** Options for {@link lombScargle}. */
export interface LombScargleOptions {
  /** Scale so that a pure sinusoid of unit amplitude peaks near 1 (default false). */
  normalize?: boolean;
  /** Subtract the mean of y before the transform (default false). */
  precenter?: boolean;
}

/**
 * Lomb-Scargle power at each angular frequency in `freqs` (rad per time unit).
 *
 * @param t - Sample times
 * @param y - Sample values, same length as t
 * @param freqs - Angular frequencies omega
 * @returns Power per frequency (unnormalized: 0.5 * sum of squared projections)
 */
export function lombScargle(t: Vec, y: Vec, freqs: Vec, opts?: LombScargleOptions): number[] {
  const times = arr(t);
  const values = arr(y);
  const omegas = arr(freqs);
  if (times.length !== values.length) {
    throw new RangeError('lombScargle: t and y must have the same length');
  }
  if (times.length === 0) throw new RangeError('lombScargle: empty input');

  let ys = values;
  if (opts?.precenter) {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    ys = values.map((v) => v - mean);
  }
  const yy = ys.reduce((s, v) => s + v * v, 0);

  return omegas.map((omega) => {
    let s2 = 0;
    let c2 = 0;
    for (const ti of times) {
      s2 += Math.sin(2 * omega * ti);
      c2 += Math.cos(2 * omega * ti);
    }
    const tau = omega === 0 ? 0 : Math.atan2(s2, c2) / (2 * omega);

    let cc = 0;
    let ss = 0;
    let yc = 0;
    let ys2 = 0;
    for (let i = 0; i < times.length; i++) {
      const phase = omega * (times[i] - tau);
      const c = Math.cos(phase);
      const s = Math.sin(phase);
      cc += c * c;
      ss += s * s;
      yc += ys[i] * c;
      ys2 += ys[i] * s;
    }
    const power = 0.5 * ((cc > 0 ? (yc * yc) / cc : 0) + (ss > 0 ? (ys2 * ys2) / ss : 0));
    if (opts?.normalize) return yy > 0 ? (2 * power) / yy : 0;
    return power;
  });
}
