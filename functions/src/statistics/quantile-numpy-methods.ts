import { readSkip } from './numeric-data.js';

/**
 * NumPy 2.x `method=` quantile definitions (Hyndman–Fan + legacy names).
 * Virtual-index recipes match `numpy/lib/_function_base_impl.py` (`_QuantileMethods`).
 */
export type NumpyQuantileMethod =
  | 'linear'
  | 'lower'
  | 'higher'
  | 'nearest'
  | 'midpoint'
  | 'inverted_cdf'
  | 'averaged_inverted_cdf'
  | 'closest_observation'
  | 'interpolated_inverted_cdf'
  | 'hazen'
  | 'weibull'
  | 'median_unbiased'
  | 'normal_unbiased';

const ALL_METHODS: readonly NumpyQuantileMethod[] = [
  'linear',
  'lower',
  'higher',
  'nearest',
  'midpoint',
  'inverted_cdf',
  'averaged_inverted_cdf',
  'closest_observation',
  'interpolated_inverted_cdf',
  'hazen',
  'weibull',
  'median_unbiased',
  'normal_unbiased',
];

/** Legacy mathjs / R names mapped to NumPy method names. */
const ALIASES: Record<string, NumpyQuantileMethod> = {
  interpolated_inverted_cdf: 'interpolated_inverted_cdf',
  // Excel PERCENTILE.INC / PERCENTILE.EXC (Hyndman–Fan types 7 and 6).
  inclusive: 'linear',
  exclusive: 'weibull',
};

/** Parse a quantile `method` string (NumPy names and mathjs/R aliases) or throw. */
export function assertNumpyQuantileMethod(mode: string): NumpyQuantileMethod {
  const mapped = (ALIASES[mode] ?? mode) as NumpyQuantileMethod;
  if (!ALL_METHODS.includes(mapped)) {
    throw new Error(
      `Unknown quantile interpolation mode "${mode}". ` +
        `Expected one of: ${ALL_METHODS.join(', ')}`
    );
  }
  return mapped;
}

/** Methods that return one observation and never interpolate. */
const DISCRETE_METHODS: ReadonlySet<NumpyQuantileMethod> = new Set<NumpyQuantileMethod>([
  'lower',
  'higher',
  'nearest',
  'inverted_cdf',
  'closest_observation',
]);

function roundHalfToEven(v: number): number {
  const f = Math.floor(v);
  const frac = v - f;
  if (frac > 0.5) return f + 1;
  if (frac < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function computeVirtualIndex(n: number, p: number, alpha: number, beta: number): number {
  return n * p + (alpha + p * (1 - alpha - beta)) - 1;
}

function virtualIndexFor(method: NumpyQuantileMethod, n: number, p: number): number {
  switch (method) {
    case 'linear':
      return (n - 1) * p;
    case 'lower':
      return Math.floor((n - 1) * p);
    case 'higher':
      return Math.ceil((n - 1) * p);
    case 'nearest':
      return roundHalfToEven((n - 1) * p);
    case 'midpoint':
      return 0.5 * (Math.floor((n - 1) * p) + Math.ceil((n - 1) * p));
    case 'inverted_cdf':
      return discreteInvertedCdf(n, p);
    case 'averaged_inverted_cdf':
      return n * p - 1;
    case 'closest_observation':
      return closestObservation(n, p);
    case 'interpolated_inverted_cdf':
      return computeVirtualIndex(n, p, 0, 1);
    case 'hazen':
      return computeVirtualIndex(n, p, 0.5, 0.5);
    case 'weibull':
      return computeVirtualIndex(n, p, 0, 0);
    case 'median_unbiased':
      return computeVirtualIndex(n, p, 1 / 3, 1 / 3);
    case 'normal_unbiased':
      return computeVirtualIndex(n, p, 3 / 8, 3 / 8);
    default:
      return (n - 1) * p;
  }
}

function discreteInvertedCdf(n: number, p: number): number {
  const index = n * p - 1;
  const prev = Math.floor(index);
  const gamma = index - prev;
  if (gamma === 0) return prev;
  return prev + 1;
}

function closestObservation(n: number, p: number): number {
  // NumPy `_closest_observation` (Hyndman-Fan type 3): index = n*p - 1.5. Take
  // floor(index) only when the fractional part is 0 and floor(index) is odd, which
  // is the even 1-based order statistic. Otherwise take the ceiling. A negative
  // index clips to 0 (`_discret_interpolation_to_boundaries`), so the sign of
  // `prev % 2` does not change the result.
  const index = n * p - 1 - 0.5;
  const prev = Math.floor(index);
  const gamma = index - prev;
  let idx = gamma === 0 && prev % 2 !== 0 ? prev : prev + 1;
  if (idx < 0) idx = 0;
  return idx;
}

function fixGamma(method: NumpyQuantileMethod, gamma: number, virtualIndex: number): number {
  switch (method) {
    case 'averaged_inverted_cdf':
      return gamma === 0 ? 0.5 : 1;
    case 'midpoint':
      return virtualIndex % 1 === 0 ? 0 : 0.5;
    default:
      return gamma;
  }
}

/**
 * Quantile of a sorted sample with a NumPy `method=` (values already sorted ascending).
 */
export function quantileOfSorted(
  sorted: readonly number[],
  p: number,
  method: NumpyQuantileMethod
): number {
  const n = sorted.length;
  if (n === 0) throw new Error('Cannot calculate quantile of an empty sequence');
  if (p < 0 || p > 1) throw new Error('N/prob must be non-negative');
  const vi = virtualIndexFor(method, n, p);
  // These methods select one observation: the virtual index is an integer.
  if (DISCRETE_METHODS.has(method)) return sorted[Math.max(0, Math.min(n - 1, vi))];
  // NumPy `_get_indexes`: an index at or above n - 1, or below 0, clips BOTH ends to the
  // boundary element. The blend below then gives that element for each gamma. An
  // infinite boundary element gives NaN (inf - inf), as NumPy.
  let leftIdx = Math.floor(vi);
  let rightIdx = leftIdx + 1;
  if (vi >= n - 1) leftIdx = rightIdx = n - 1;
  else if (vi < 0) leftIdx = rightIdx = 0;
  const left = sorted[leftIdx];
  const right = sorted[rightIdx];
  const gamma = fixGamma(method, vi - leftIdx, vi);
  // NumPy `_lerp`: blend from the nearer end, so an infinite end does not give inf - inf.
  const diff = right - left;
  const r = gamma >= 0.5 ? right - diff * (1 - gamma) : left + diff * gamma;
  // One infinite end gives inf - inf above; the plain blend keeps that end (as mathjs).
  return r !== r ? left + gamma * diff : r;
}

/** Third argument to `quantileSeq`: NumPy-style `{ method, sorted }` or legacy forms. */
export interface QuantileSeqOptions {
  method?: string;
  sorted?: boolean;
  /** Omit NaN values, as `numpy.nanquantile`. `±Infinity` is kept. */
  skipNaN?: boolean;
  /** Pandas spelling of {@link skipNaN}. */
  skipna?: boolean;
}

/** Normalize `quantileSeq`'s optional third argument to `{ sorted, mode }`. */
export function parseQuantileThirdArg(
  third: unknown
): { sorted: boolean; mode: NumpyQuantileMethod; skipNaN: boolean } | null {
  if (third === null || third === undefined) return null;
  if (typeof third === 'boolean') return { sorted: third, mode: 'linear', skipNaN: false };
  if (typeof third === 'string') {
    return { sorted: false, mode: assertNumpyQuantileMethod(third), skipNaN: false };
  }
  if (typeof third === 'object' && !Array.isArray(third)) {
    const o = third as QuantileSeqOptions;
    const mode = assertNumpyQuantileMethod(o.method ?? 'linear');
    return { sorted: o.sorted ?? false, mode, skipNaN: readSkip(o) ?? false };
  }
  return null;
}
