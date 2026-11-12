/**
 * Shared numeric-vector handling for statistics reductions (G19).
 *
 * Empty-input convention (documented in statistics/README): `mean`, `median`,
 * `mode`, `variance`, and `std` return `NaN` on length 0 (no throw). `mode`
 * otherwise returns the list of modes.
 */
import { flatten } from '../utils/array.js';

/** A `Float32Array` or `Float64Array` numeric column. */
export type FloatTyped = Float32Array | Float64Array;

/** Plain array or typed-array input accepted by typed reductions. */
export type NumericVectorInput = number[] | FloatTyped;

/** mathjs variance/std normalization strings. */
export type VarianceNorm = 'unbiased' | 'uncorrected' | 'biased';

/** Options for NumPy-style statistics (`ddof`, `skipNaN` / `skipna`). */
export type StatReduceOptions = {
  /**
   * NumPy/pandas delta degrees of freedom. The divisor is `n - ddof`.
   * `0` is population (`'uncorrected'`), `1` is sample (`'unbiased'`).
   * Any non-negative integer is accepted; `ddof >= n` yields `NaN`.
   */
  ddof?: number;
  /** Omit NaN values, as `numpy.nanmean`. `±Infinity` is kept. */
  skipNaN?: boolean;
  /** Pandas spelling of {@link skipNaN}. */
  skipna?: boolean;
  /** mathjs normalization. Conflicts with `ddof` when they name different divisors. */
  normalization?: VarianceNorm;
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

/** Flatten factory inputs: plain array, matrix `toArray`/`valueOf`, or typed array (no `Array.from`). */
export function flattenForStatistics(array: unknown[] | MatrixLike | FloatTyped): unknown[] {
  if (isFloatTyped(array)) {
    return copyToNumberArray(array) as unknown[];
  }
  if (
    array &&
    typeof array === 'object' &&
    typeof (array as { toArray?: unknown }).toArray === 'function'
  ) {
    return flatten((array as unknown as { toArray(): unknown }).toArray()) as unknown[];
  }
  return flatten((array as MatrixLike).valueOf()) as unknown[];
}

/** Optionally drop NaN entries before a reduction. `±Infinity` is kept (NumPy `nanmean`). */
export function finiteNumbers(x: ArrayLike<number>, skipNaN: boolean): number[] {
  if (!skipNaN) {
    if (Array.isArray(x)) return x as number[];
    return copyToNumberArray(x);
  }
  const out: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (!Number.isNaN(v)) out.push(v);
  }
  return out;
}

const VARIANCE_NORMS: ReadonlySet<string> = new Set(['unbiased', 'uncorrected', 'biased']);

/** True when `value` is one of the mathjs variance normalization strings. */
export function isVarianceNorm(value: unknown): value is VarianceNorm {
  return typeof value === 'string' && VARIANCE_NORMS.has(value);
}

function readSkip(o: StatReduceOptions): boolean | undefined {
  const a = o.skipNaN;
  const b = o.skipna;
  if (a !== undefined && typeof a !== 'boolean') {
    throw new TypeError('skipNaN must be a boolean');
  }
  if (b !== undefined && typeof b !== 'boolean') {
    throw new TypeError('skipna must be a boolean');
  }
  if (a !== undefined && b !== undefined && a !== b) {
    throw new TypeError('skipNaN and skipna disagree');
  }
  return a ?? b;
}

/** Parse and validate the second-argument options object for typed stats. */
export function parseStatOptions(arg: unknown): StatReduceOptions {
  if (arg === null || arg === undefined || typeof arg !== 'object' || Array.isArray(arg)) {
    throw new TypeError(
      'Expected an options object with optional ddof (non-negative integer), normalization ' +
        "('unbiased' | 'uncorrected' | 'biased'), and skipNaN/skipna (boolean)"
    );
  }
  const o = arg as StatReduceOptions;
  const out: StatReduceOptions = {};
  if (o.ddof !== undefined) {
    if (typeof o.ddof !== 'number' || !Number.isInteger(o.ddof) || o.ddof < 0) {
      throw new TypeError('ddof must be a non-negative integer');
    }
    out.ddof = o.ddof;
  }
  if (o.normalization !== undefined) {
    if (!isVarianceNorm(o.normalization)) {
      throw new TypeError(
        `Unknown normalization "${String(o.normalization)}". ` +
          'Choose "unbiased" (default), "uncorrected", or "biased".'
      );
    }
    out.normalization = o.normalization;
  }
  const skip = readSkip(o);
  if (skip !== undefined) out.skipNaN = skip;
  if (out.ddof === undefined && out.skipNaN === undefined && out.normalization === undefined) {
    throw new TypeError(
      'Expected an options object with optional ddof (non-negative integer), normalization ' +
        "('unbiased' | 'uncorrected' | 'biased'), and skipNaN/skipna (boolean)"
    );
  }
  if (out.ddof !== undefined && out.normalization !== undefined) {
    const expected = out.ddof === 0 ? 'uncorrected' : out.ddof === 1 ? 'unbiased' : undefined;
    if (expected !== out.normalization) {
      throw new TypeError(
        `Conflicting variance options: { ddof: ${out.ddof} } and normalization ` +
          `'${out.normalization}'. Pass one divisor, not both.`
      );
    }
  }
  return out;
}

/** How to scale a sum of squared deviations. `ddof` follows NumPy (`NaN` when `n <= ddof`). */
export type VarianceRequest = { kind: 'norm'; norm: VarianceNorm } | { kind: 'ddof'; ddof: number };

/**
 * Map `{ ddof }`, a normalization string, or both to a variance request + skip flag.
 * A string alone keeps the mathjs divisor (`'unbiased'` on one value is 0).
 * An explicit `ddof` uses NumPy: divide by `n - ddof`, and return `NaN` when that is not positive.
 */
export function normalizationFromSecondArg(
  arg: string | StatReduceOptions | undefined,
  defaultNorm: VarianceNorm = 'unbiased'
): { request: VarianceRequest; skipNaN: boolean } {
  if (arg === undefined) return { request: { kind: 'norm', norm: defaultNorm }, skipNaN: false };
  if (typeof arg === 'string') {
    if (!isVarianceNorm(arg)) {
      throw new TypeError(
        `Unknown normalization "${arg}". Choose "unbiased" (default), "uncorrected", or "biased".`
      );
    }
    return { request: { kind: 'norm', norm: arg }, skipNaN: false };
  }
  const opts = parseStatOptions(arg);
  if (opts.ddof !== undefined) {
    return { request: { kind: 'ddof', ddof: opts.ddof }, skipNaN: opts.skipNaN === true };
  }
  return {
    request: { kind: 'norm', norm: opts.normalization ?? defaultNorm },
    skipNaN: opts.skipNaN === true,
  };
}

/**
 * Merge a positional mathjs normalization string with an options object.
 * Disagreeing `ddof` and normalization throw.
 */
export function normalizationFromStringAndOptions(
  norm: string,
  opts: StatReduceOptions | undefined,
  defaultNorm: VarianceNorm = 'unbiased'
): { request: VarianceRequest; skipNaN: boolean } {
  if (opts?.normalization !== undefined && opts.normalization !== norm) {
    throw new TypeError(
      `Conflicting variance options: normalization '${norm}' and '${opts.normalization}'. ` +
        'Pass one divisor, not both.'
    );
  }
  return normalizationFromSecondArg({ ...opts, normalization: norm as VarianceNorm }, defaultNorm);
}

function unwrapStatsInput(input: unknown): unknown {
  if (Array.isArray(input) || isFloatTyped(input) || input == null) return input;
  if (typeof input === 'object') {
    const o = input as { toArray?: () => unknown; valueOf?: () => unknown };
    if (typeof o.toArray === 'function') return o.toArray();
    if (typeof o.valueOf === 'function') {
      const v = o.valueOf();
      if (v !== input) return v;
    }
  }
  return input;
}

/**
 * A rectangular numeric matrix as rows, or `null` when `input` is not one
 * (1-d data, BigNumber cells, ragged rows).
 */
export function numberGrid(input: unknown): number[][] | null {
  const raw = unwrapStatsInput(input);
  if (!Array.isArray(raw) || raw.length === 0 || !Array.isArray(raw[0])) return null;
  const rows = raw as unknown[][];
  const cols = rows[0].length;
  const out: number[][] = new Array(rows.length);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length !== cols) return null;
    const copy = new Array<number>(cols);
    for (let c = 0; c < cols; c++) {
      if (typeof row[c] !== 'number') return null;
      copy[c] = row[c] as number;
    }
    out[r] = copy;
  }
  return out;
}

/** Flatten a numeric vector or rectangular matrix. NaNs are kept unless `skipNaN`. */
export function flattenNumeric(input: unknown, skipNaN: boolean): number[] {
  const grid = numberGrid(input);
  if (grid) {
    const out: number[] = [];
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (!skipNaN || !Number.isNaN(v)) out.push(v);
      }
    }
    return out;
  }
  const raw = unwrapStatsInput(input);
  if (Array.isArray(raw) || isFloatTyped(raw)) {
    if (Array.isArray(raw)) {
      for (let i = 0; i < raw.length; i++) {
        if (typeof raw[i] !== 'number') {
          throw new TypeError('expected numeric values');
        }
      }
    }
    return finiteNumbers(raw as ArrayLike<number>, skipNaN);
  }
  throw new TypeError('expected a numeric vector or matrix');
}

/**
 * Reduce a numeric vector (`dim` 0) or a 2-d matrix along axis `dim` (0 = columns, 1 = rows).
 */
export function reduceNumericMatrix(
  input: unknown,
  dim: number | { valueOf(): number },
  skipNaN: boolean,
  reduce: (xs: ArrayLike<number>) => number
): number | number[] {
  const dimValue = typeof dim === 'number' ? dim : dim.valueOf();
  if (!Number.isInteger(dimValue) || dimValue < 0) {
    throw new RangeError(`dim must be a non-negative integer (got ${String(dimValue)})`);
  }
  const grid = numberGrid(input);
  if (grid) {
    if (dimValue > 1) {
      throw new RangeError(`dim ${dimValue} out of range for a 2-d matrix`);
    }
    if (dimValue === 1) {
      return grid.map((row) => reduce(skipNaN ? finiteNumbers(row, true) : row));
    }
    const cols = grid[0].length;
    const out = new Array<number>(cols);
    for (let c = 0; c < cols; c++) {
      const col = new Array<number>(grid.length);
      for (let r = 0; r < grid.length; r++) col[r] = grid[r][c];
      out[c] = reduce(skipNaN ? finiteNumbers(col, true) : col);
    }
    return out;
  }
  const raw = unwrapStatsInput(input);
  if (Array.isArray(raw) || isFloatTyped(raw)) {
    if (dimValue !== 0) {
      throw new RangeError(`dim ${dimValue} out of range for a 1-d vector`);
    }
    return reduce(flattenNumeric(raw, skipNaN));
  }
  throw new TypeError('expected a numeric vector or matrix');
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
