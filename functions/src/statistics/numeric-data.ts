/**
 * Shared numeric-vector handling for statistics reductions (G19).
 *
 * Empty-input convention (documented in statistics/README): `mean`, `median`,
 * `variance`, `std`, and typed `nan*` helpers return `NaN` on length 0; `mode`
 * returns `[]` (no modes). This matches NumPy/pandas graceful handling without
 * throwing through `map` pipelines.
 */
import { flatten } from '../utils/array.js';

/** A `Float32Array` or `Float64Array` numeric column. */
export type FloatTyped = Float32Array | Float64Array;

/** Plain array or typed-array input accepted by typed reductions. */
export type NumericVectorInput = number[] | FloatTyped;

/** Options for NumPy-style statistics (`ddof`, `skipNaN`). */
export type StatReduceOptions = {
  /** NumPy/pandas spelling: 0 = population (uncorrected), 1 = sample (unbiased). */
  ddof?: number;
  /** Omit non-finite values (NaN, ±Infinity), as `numpy.nanmean`. */
  skipNaN?: boolean;
};

/** Type guard for {@link FloatTyped} buffers. */
export function isFloatTyped(x: unknown): x is FloatTyped {
  return x instanceof Float32Array || x instanceof Float64Array;
}

/** Copy `ArrayLike<number>` into a mutable `number[]` without `Array.from`. */
export function copyToNumberArray(a: ArrayLike<number>): number[] {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i];
  return out;
}

interface MatrixLike {
  valueOf(): unknown[] | unknown[][];
}

/** Flatten factory inputs: plain array, matrix `valueOf`, or typed array (no `Array.from`). */
export function flattenForStatistics(array: unknown[] | MatrixLike | FloatTyped): unknown[] {
  if (isFloatTyped(array)) {
    return copyToNumberArray(array) as unknown[];
  }
  return flatten((array as MatrixLike).valueOf()) as unknown[];
}

/** Optionally drop non-finite entries before a reduction. */
export function finiteNumbers(x: NumericVectorInput, skipNaN: boolean): number[] {
  if (!skipNaN) {
    if (Array.isArray(x)) return x;
    return copyToNumberArray(x);
  }
  const out: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

/** Parse and validate the second-argument options object for typed stats. */
export function parseStatOptions(arg: unknown): StatReduceOptions {
  if (arg === null || arg === undefined || typeof arg !== 'object' || Array.isArray(arg)) {
    throw new TypeError(
      'Expected an options object with optional ddof (0 or 1) and skipNaN (boolean)'
    );
  }
  const o = arg as StatReduceOptions;
  const out: StatReduceOptions = {};
  if (o.ddof !== undefined) {
    if (typeof o.ddof !== 'number' || !Number.isInteger(o.ddof) || o.ddof < 0) {
      throw new TypeError('ddof must be a non-negative integer');
    }
    if (o.ddof !== 0 && o.ddof !== 1) {
      throw new TypeError(`variance ddof must be 0 or 1 (got ${o.ddof})`);
    }
    out.ddof = o.ddof;
  }
  if (o.skipNaN !== undefined) {
    if (typeof o.skipNaN !== 'boolean') {
      throw new TypeError('skipNaN must be a boolean');
    }
    out.skipNaN = o.skipNaN;
  }
  if (out.ddof === undefined && out.skipNaN === undefined) {
    throw new TypeError(
      'Expected an options object with optional ddof (0 or 1) and skipNaN (boolean)'
    );
  }
  return out;
}

/** Map NumPy `ddof` or mathjs normalization string to variance normalization. */
type VarianceNorm = 'unbiased' | 'uncorrected' | 'biased';

/** Map `{ ddof }`, a normalization string, or both to variance normalization + skipNaN. */
export function normalizationFromSecondArg(
  arg: string | StatReduceOptions | undefined,
  defaultNorm: VarianceNorm = 'unbiased'
): { norm: VarianceNorm; skipNaN: boolean } {
  if (arg === undefined) return { norm: defaultNorm, skipNaN: false };
  if (typeof arg === 'string') {
    return { norm: arg as VarianceNorm, skipNaN: false };
  }
  const opts = parseStatOptions(arg);
  let norm = defaultNorm;
  if (opts.ddof !== undefined) {
    norm = opts.ddof === 0 ? 'uncorrected' : 'unbiased';
  }
  return { norm, skipNaN: opts.skipNaN === true };
}

/** True when every element strictly equals the first (variance is exactly 0). */
export function isConstantArrayLike(xs: ArrayLike<number>): boolean {
  const n = xs.length;
  if (n < 2) return true;
  const x0 = xs[0];
  for (let i = 1; i < n; i++) {
    if (xs[i] !== x0) return false;
  }
  return true;
}

/** Copy two equally-sized typed arrays into `number[]` pairs for Pearson `corr`. */
export function typedArrayPairToNumbers(A: FloatTyped, B: FloatTyped): [number[], number[]] {
  if (A.length !== B.length) {
    throw new SyntaxError(
      `Dimension mismatch. Array A and B must have the same number of elements.`
    );
  }
  return [copyToNumberArray(A), copyToNumberArray(B)];
}
