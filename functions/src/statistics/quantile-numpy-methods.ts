import { readSkip } from './numeric-data.js';
import { minFrom, quickSelectInPlace } from '../utils/median-numbers.js';

/**
 * NumPy 2.x `method=` quantile definitions (Hyndman–Fan + legacy names).
 * Virtual-index recipes match `numpy/lib/_function_base_impl.py` (`_QuantileMethods`).
 *
 * One plan serves every value type. {@link quantilePlan} turns a method, a sample size and a
 * probability into two order-statistic indexes and a weight. It does the arithmetic through a
 * {@link QuantileArith}, so a `number` probability and a BigNumber probability follow the same
 * recipe. The evaluators (this file for numbers, `quantileSeq.ts` for the other types) pick the
 * values at those indexes and blend them.
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

/**
 * The arithmetic that a plan needs, over the type `T` of the probability. Every value is exact
 * in its own type: a `number` probability gives the float indexes of NumPy, a BigNumber
 * probability gives the exact decimal indexes.
 */
export interface QuantileArith<T> {
  /** The ratio `num / den` (`den` defaults to 1) as a `T`. */
  ratio(num: number, den?: number): T;
  add(a: T, b: T): T;
  sub(a: T, b: T): T;
  mul(a: T, b: T): T;
  /** The largest integer that is not above `x`, as a JS number. */
  floor(x: T): number;
  /** The sign of `x - y`: -1, 0 or 1. */
  cmp(x: T, y: T): number;
}

/** The arithmetic of a JS `number` probability. */
export const NUMBER_ARITH: QuantileArith<number> = {
  ratio: (num, den = 1) => (den === 1 ? num : num / den),
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  floor: Math.floor,
  cmp: (x, y) => (x < y ? -1 : x > y ? 1 : 0),
};

/**
 * The order statistics that a quantile reads (0-based, ascending order) and the weight of the
 * right one. `leftIdx === rightIdx` means that the quantile is one observation, and `gamma` is
 * then 0.
 */
export interface QuantilePlan<T> {
  leftIdx: number;
  rightIdx: number;
  gamma: T;
}

/**
 * Plan the quantile of `n` sorted observations at probability `p` (NumPy `_get_indexes` and
 * `_get_gamma`). A weight of 0 gives the left observation and a weight of 1 the right one, so the
 * plan then names that one index twice.
 *
 * @throws if `n` is 0, or `p` is outside [0, 1]. A NaN `p` is the caller's to handle.
 */
export function quantilePlan<T>(
  method: NumpyQuantileMethod,
  n: number,
  p: T,
  ar: QuantileArith<T>
): QuantilePlan<T> {
  if (n === 0) throw new Error('Cannot calculate quantile of an empty sequence');
  const zero = ar.ratio(0);
  const one = ar.ratio(1);
  if (ar.cmp(p, zero) < 0 || ar.cmp(p, one) > 0) throw new Error('N/prob must be non-negative');
  const half = ar.ratio(1, 2);
  const last = n - 1;
  const nP = (): T => ar.mul(ar.ratio(n), p);
  const lastP = (): T => ar.mul(ar.ratio(last), p);
  const whole = (v: T, floor: number): boolean => ar.cmp(v, ar.ratio(floor)) === 0;

  // One observation, clipped to the sample (NumPy `_discret_interpolation_to_boundaries`).
  const select = (idx: number): QuantilePlan<T> => {
    const i = idx < 0 ? 0 : idx > last ? last : idx;
    return { leftIdx: i, rightIdx: i, gamma: zero };
  };

  // Blend two neighbours at a virtual index (NumPy `_get_indexes`): an index at or above n - 1,
  // or below 0, clips both ends to the boundary observation.
  const interpolate = (vi: T, averaged: boolean): QuantilePlan<T> => {
    let leftIdx = ar.floor(vi);
    let rightIdx = leftIdx + 1;
    if (ar.cmp(vi, ar.ratio(last)) >= 0) leftIdx = rightIdx = last;
    else if (ar.cmp(vi, zero) < 0) leftIdx = rightIdx = 0;
    let gamma = ar.sub(vi, ar.ratio(leftIdx));
    if (averaged) gamma = ar.cmp(gamma, zero) === 0 ? half : one;
    // Weight 0 gives the left observation, weight 1 the right one: no second index is needed.
    if (ar.cmp(gamma, zero) === 0) rightIdx = leftIdx;
    else if (ar.cmp(gamma, one) === 0) leftIdx = rightIdx;
    if (leftIdx === rightIdx) gamma = zero;
    return { leftIdx, rightIdx, gamma };
  };

  // NumPy `_compute_virtual_index`: n * p + (alpha + p * (1 - alpha - beta)) - 1.
  const continuous = (alpha: T, beta: T): QuantilePlan<T> =>
    interpolate(
      ar.sub(ar.add(nP(), ar.add(alpha, ar.mul(p, ar.sub(ar.sub(one, alpha), beta)))), one),
      false
    );

  switch (method) {
    case 'lower': {
      return select(ar.floor(lastP()));
    }
    case 'higher': {
      const v = lastP();
      const f = ar.floor(v);
      return select(whole(v, f) ? f : f + 1);
    }
    case 'nearest': {
      // Round half to even, as NumPy `np.around`.
      const v = lastP();
      const f = ar.floor(v);
      const c = ar.cmp(ar.sub(v, ar.ratio(f)), half);
      return select(c < 0 ? f : c > 0 ? f + 1 : f % 2 === 0 ? f : f + 1);
    }
    case 'midpoint': {
      const v = lastP();
      const f = ar.floor(v);
      if (whole(v, f)) return select(f);
      return { leftIdx: f, rightIdx: f + 1, gamma: half };
    }
    case 'inverted_cdf': {
      const v = ar.sub(nP(), one);
      const f = ar.floor(v);
      return select(whole(v, f) ? f : f + 1);
    }
    case 'closest_observation': {
      // NumPy `_closest_observation` (Hyndman-Fan type 3): index = n*p - 1.5. Take
      // floor(index) only when the fractional part is 0 and floor(index) is odd, which
      // is the even 1-based order statistic. Otherwise take the ceiling. A negative
      // index clips to 0, so the sign of `f % 2` does not change the result.
      const v = ar.sub(ar.sub(nP(), one), half);
      const f = ar.floor(v);
      return select(whole(v, f) && f % 2 !== 0 ? f : f + 1);
    }
    case 'averaged_inverted_cdf':
      return interpolate(ar.sub(nP(), one), true);
    case 'interpolated_inverted_cdf':
      return continuous(zero, one);
    case 'hazen':
      return continuous(half, half);
    case 'weibull':
      return continuous(zero, zero);
    case 'median_unbiased':
      return continuous(ar.ratio(1, 3), ar.ratio(1, 3));
    case 'normal_unbiased':
      return continuous(ar.ratio(3, 8), ar.ratio(3, 8));
    case 'linear':
    default:
      return interpolate(lastP(), false);
  }
}

/**
 * Blend two neighbouring observations at weight `gamma` (0 < gamma < 1 for a real blend).
 *
 * One rule for every input (#1131). It keeps NumPy `_lerp` while `right - left` is finite. For an
 * infinite or an overflowing difference it returns `left` at weight 0 (or when both ends are
 * equal), `right` at weight 1, and `left * (1 - gamma) + right * gamma` between, so the quantile
 * at 0 is the minimum, the quantile at 1 is the maximum, and the result never goes down as the
 * probability goes up.
 */
export function blendNumber(left: number, right: number, gamma: number): number {
  if (gamma === 0 || left === right) return left;
  if (gamma === 1) return right;
  const diff = right - left;
  // NumPy `_lerp`: blend from the nearer end.
  if (Number.isFinite(diff)) return gamma >= 0.5 ? right - diff * (1 - gamma) : left + diff * gamma;
  return left * (1 - gamma) + right * gamma;
}

/**
 * The two order statistics that `plan` names, read from `work`. When `ordered` is false `work`
 * is reordered by selection (O(n), no sort) and must hold no NaN; the right end is then the
 * smallest value right of the left end.
 */
export function orderStatistics(
  work: Float64Array,
  plan: { leftIdx: number; rightIdx: number },
  ordered: boolean
): [number, number] {
  const { leftIdx, rightIdx } = plan;
  if (ordered) return [work[leftIdx], work[rightIdx]];
  const left = quickSelectInPlace(work, 0, work.length - 1, leftIdx);
  return [left, rightIdx === leftIdx ? left : minFrom(work, leftIdx + 1)];
}

/**
 * Quantile of a sorted sample with a NumPy `method=` (values already sorted ascending).
 */
export function quantileOfSorted(
  sorted: ArrayLike<number>,
  p: number,
  method: NumpyQuantileMethod
): number {
  if (p !== p) return NaN;
  const plan = quantilePlan(method, sorted.length, p, NUMBER_ARITH);
  const left = sorted[plan.leftIdx];
  return plan.leftIdx === plan.rightIdx
    ? left
    : blendNumber(left, sorted[plan.rightIdx], plan.gamma);
}

/**
 * Quantile of `work` by selection, not by a full sort. `work` holds no NaN and is reordered.
 * Cost is O(n), as `median`.
 */
export function quantileOfUnsorted(
  work: Float64Array,
  p: number,
  method: NumpyQuantileMethod
): number {
  if (p !== p) return NaN;
  const plan = quantilePlan(method, work.length, p, NUMBER_ARITH);
  const [left, right] = orderStatistics(work, plan, false);
  return plan.leftIdx === plan.rightIdx ? left : blendNumber(left, right, plan.gamma);
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

/** The options of one `quantileSeq` call, after parsing. */
export interface ParsedQuantileOptions {
  sorted: boolean;
  mode: NumpyQuantileMethod;
  skipNaN: boolean;
}

/**
 * Normalize the optional arguments after the probability to `{ sorted, mode, skipNaN }`.
 * Accepted forms: nothing, `sorted`, `method`, `{ method, sorted, skipNaN }`, and `sorted, method`.
 */
export function parseQuantileThirdArg(third?: unknown, fourth?: string): ParsedQuantileOptions {
  if (typeof third === 'boolean') {
    return {
      sorted: third,
      mode: fourth === undefined ? 'linear' : assertNumpyQuantileMethod(fourth),
      skipNaN: false,
    };
  }
  if (typeof third === 'string') {
    return { sorted: false, mode: assertNumpyQuantileMethod(third), skipNaN: false };
  }
  if (third !== null && typeof third === 'object' && !Array.isArray(third)) {
    const o = third as QuantileSeqOptions;
    return {
      sorted: o.sorted ?? false,
      mode: assertNumpyQuantileMethod(o.method ?? 'linear'),
      skipNaN: readSkip(o) ?? false,
    };
  }
  return { sorted: false, mode: 'linear', skipNaN: false };
}
