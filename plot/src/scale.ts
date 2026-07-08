/** [min, max] of a numeric array; a degenerate (flat) range is padded by ±1. */
export function extent(xs: readonly number[]): [number, number] {
  if (xs.length === 0) return [0, 1];
  let lo = xs[0];
  let hi = xs[0];
  for (const v of xs) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === hi) return [lo - 1, hi + 1];
  return [lo, hi];
}

/** Linear map from data domain to pixel range. */
export function linearScale(dom: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = dom;
  const [r0, r1] = range;
  const m = (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * m;
}

/** Log10 map; the domain is clamped to strictly-positive. */
export function logScale(dom: [number, number], range: [number, number]): (v: number) => number {
  const d0 = Math.log10(Math.max(dom[0], Number.MIN_VALUE));
  const d1 = Math.log10(Math.max(dom[1], Number.MIN_VALUE));
  const [r0, r1] = range;
  const m = (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (Math.log10(Math.max(v, Number.MIN_VALUE)) - d0) * m;
}

/** "Nice" round tick values covering [min,max] (Wilkinson-lite: 1/2/5 × 10^k step). */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + step * 0.5; t += step) ticks.push(Math.round(t / step) * step);
  return ticks;
}
