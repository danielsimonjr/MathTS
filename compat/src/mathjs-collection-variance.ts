/**
 * mathjs 15.3.0 matrix variance along a dimension (#1786).
 * Native `functions` uses a numerically stable variance path that can differ in
 * the last IEEE bit from mathjs; this mirrors mathjs's two-pass typed ops.
 */
type StatisticsNormalization = 'unbiased' | 'uncorrected' | 'biased';

type UnaryOps = {
  add: (...args: unknown[]) => unknown;
  subtract: (...args: unknown[]) => unknown;
  multiply: (...args: unknown[]) => unknown;
  divide: (...args: unknown[]) => unknown;
  sqrt: (...args: unknown[]) => unknown;
  mapSlices: (array: unknown, dim: number, callback: (slice: unknown) => unknown) => unknown;
};

function apply(op: (...args: unknown[]) => unknown, args: unknown[]): unknown {
  return op(...args);
}

function deepForEachScalar(array: unknown, fn: (value: unknown) => void): void {
  if (Array.isArray(array)) {
    for (const item of array) deepForEachScalar(item, fn);
    return;
  }
  fn(array);
}

function mathjsNaiveVariance(
  array: unknown,
  normalization: StatisticsNormalization,
  ops: Pick<UnaryOps, 'add' | 'subtract' | 'multiply' | 'divide'>
): unknown {
  const { add, subtract, multiply, divide } = ops;
  let sum: unknown;
  let num = 0;
  deepForEachScalar(array, (value) => {
    sum = sum === undefined ? value : apply(add, [sum, value]);
    num++;
  });
  if (num === 0) throw new Error('Cannot calculate variance of an empty array');
  const mean = apply(divide, [sum, num]);
  let sqSum: unknown;
  deepForEachScalar(array, (value) => {
    const diff = apply(subtract, [value, mean]);
    const sq = apply(multiply, [diff, diff]);
    sqSum = sqSum === undefined ? sq : apply(add, [sqSum, sq]);
  });
  switch (normalization) {
    case 'uncorrected':
      return apply(divide, [sqSum, num]);
    case 'biased':
      return apply(divide, [sqSum, num + 1]);
    case 'unbiased':
    default:
      if (num === 1) return apply(multiply, [sqSum, 0]);
      return apply(divide, [sqSum, num - 1]);
  }
}

function dimToNumber(dim: unknown): number {
  if (typeof dim === 'number') return dim;
  if (
    dim !== null &&
    typeof dim === 'object' &&
    typeof (dim as { toNumber?: () => number }).toNumber === 'function'
  ) {
    return (dim as { toNumber(): number }).toNumber();
  }
  return Number(dim);
}

/** Variance along `dim` on nested arrays using mathjs-style ops. */
export function mathjsCollectionVarianceAlongDim(
  array: unknown,
  dim: unknown,
  normalization: StatisticsNormalization,
  ops: UnaryOps
): unknown {
  const dimNum = dimToNumber(dim);
  return ops.mapSlices(array, dimNum, (slice) => mathjsNaiveVariance(slice, normalization, ops));
}

function deepMapNumbers(value: unknown, fn: (n: number) => unknown): unknown {
  if (typeof value === 'number') return fn(value);
  if (Array.isArray(value)) return value.map((entry) => deepMapNumbers(entry, fn));
  return value;
}

/** `std` along `dim` = `sqrt(variance)`. */
export function mathjsCollectionStdAlongDim(
  array: unknown,
  dim: unknown,
  normalization: StatisticsNormalization,
  ops: UnaryOps
): unknown {
  const variance = mathjsCollectionVarianceAlongDim(array, dim, normalization, ops);
  return deepMapNumbers(variance, (n) => apply(ops.sqrt, [n]));
}
