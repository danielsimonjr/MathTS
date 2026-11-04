/**
 * Distances between samples and discrete information measures (gap-analysis
 * 2026-11-04, Batch A).
 */
type Vec = readonly number[] | Float64Array;

const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

/**
 * 1-D Wasserstein (earth mover's) distance: ∫|F_u(t) − F_v(t)| dt, computed
 * exactly over the merged support. Default weights are uniform.
 */
export function wassersteinDistance(
  u: Vec,
  v: Vec,
  opts?: { uWeights?: Vec; vWeights?: Vec }
): number {
  const uv = arr(u);
  const vv = arr(v);
  if (uv.length === 0 || vv.length === 0) throw new RangeError('wassersteinDistance: empty sample');
  const uw = normWeights(uv, opts?.uWeights);
  const vw = normWeights(vv, opts?.vWeights);
  const points = [...new Set([...uv, ...vv])].sort((a, b) => a - b);
  let total = 0;
  for (let k = 0; k < points.length - 1; k++) {
    const t = points[k];
    const cu = cdfAt(uv, uw, t);
    const cv = cdfAt(vv, vw, t);
    total += Math.abs(cu - cv) * (points[k + 1] - t);
  }
  return total;
}

function normWeights(x: number[], w: Vec | undefined): number[] {
  if (!w) return x.map(() => 1 / x.length);
  const ws = arr(w);
  if (ws.length !== x.length) throw new RangeError('weights must match sample length');
  if (ws.some((v) => v < 0)) throw new RangeError('weights must be non-negative');
  const s = ws.reduce((acc, v) => acc + v, 0);
  if (s === 0) throw new RangeError('weights must not sum to zero');
  return ws.map((v) => v / s);
}

/** Weighted CDF F(t) = Σ_{xᵢ ≤ t} wᵢ. */
function cdfAt(x: number[], w: number[], t: number): number {
  let f = 0;
  for (let i = 0; i < x.length; i++) if (x[i] <= t) f += w[i];
  return f;
}

/**
 * Energy distance √(2E|U−V| − E|U−U′| − E|V−V′|) using V-statistic means
 * (diagonal pairs included).
 */
export function energyDistance(u: Vec, v: Vec): number {
  const uv = arr(u);
  const vv = arr(v);
  if (uv.length === 0 || vv.length === 0) throw new RangeError('energyDistance: empty sample');
  const meanAbs = (a: number[], b: number[]): number => {
    let s = 0;
    for (const p of a) for (const q of b) s += Math.abs(p - q);
    return s / (a.length * b.length);
  };
  const val = 2 * meanAbs(uv, vv) - meanAbs(uv, uv) - meanAbs(vv, vv);
  return Math.sqrt(Math.max(0, val));
}

/** Mutual information (nats) of two discrete label sequences. */
export function mutualInformation(x: readonly number[], y: readonly number[]): number {
  if (x.length !== y.length) throw new RangeError('x and y must have the same length');
  const n = x.length;
  if (n === 0) throw new RangeError('mutualInformation: empty input');
  const px = new Map<number, number>();
  const py = new Map<number, number>();
  const pxy = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    px.set(x[i], (px.get(x[i]) ?? 0) + 1);
    py.set(y[i], (py.get(y[i]) ?? 0) + 1);
    const key = `${x[i]}\u0000${y[i]}`;
    pxy.set(key, (pxy.get(key) ?? 0) + 1);
  }
  let mi = 0;
  for (const [key, c] of pxy) {
    const [a, b] = key.split('\u0000').map(Number);
    const pj = c / n;
    mi += pj * Math.log(pj / (((px.get(a) ?? 0) / n) * ((py.get(b) ?? 0) / n)));
  }
  return mi;
}

/** Empirical CDF: step points and an `evaluate(t)` function (fraction of values ≤ t). */
export function ecdf(x: Vec): { x: number[]; y: number[]; evaluate: (t: number) => number } {
  const xs = arr(x)
    .slice()
    .sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) throw new RangeError('ecdf: empty sample');
  const ux: number[] = [];
  const uy: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === n - 1 || xs[i + 1] !== xs[i]) {
      ux.push(xs[i]);
      uy.push((i + 1) / n);
    }
  }
  const evaluate = (t: number): number => {
    let lo = 0;
    let hi = xs.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (xs[mid] <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo / n;
  };
  return { x: ux, y: uy, evaluate };
}
