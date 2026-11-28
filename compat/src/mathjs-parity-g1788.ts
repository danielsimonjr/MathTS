/**
 * mathjs 15.3.0 relational compares and statistics parity (#1788).
 *
 * Compat-only adapters: activated mathjs relational factories (relTol, null and
 * undefined), statistics factories, and a handful of mathjs-shaped error / NaN
 * behaviors the native critical libraries intentionally diverge on.
 */

import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import {
  factory_compare,
  factory_cumsum,
  factory_equal,
  factory_larger,
  factory_largerEq,
  factory_max,
  factory_mean,
  factory_min,
  factory_smaller,
  factory_smallerEq,
  factory_std,
  factory_sum,
  factory_variance,
  quantileSeq as factoryQuantileSeq,
  corr as factoryCorr,
} from '@danielsimonjr/mathts-functions';
import { isUnit, type TypedFunction } from '@danielsimonjr/mathts-core';
import {
  createCompareNatural,
  createDeepEqual,
  createEqualScalar,
  createUnequal,
} from './all-factories.js';
import { applyUnitRelationalParity, type UnitRelationalOps } from './unit-relational.js';
import { createCompatCompare } from './mathjs-parity-g06.js';
import {
  invalidNumericStringError,
  isMatrixLikeValue,
  keepSurface,
  statisticsEmptyParametersError,
  tooFewArgumentsError,
  tooManyArgumentsError,
  withStatisticsMultiCollectionGuard,
} from './mathjs-parity-g02.js';

type UnaryLike = (...args: never[]) => unknown;

const STATISTICS_NORMALIZATION = new Set(['unbiased', 'uncorrected', 'biased']);

function isStatisticsNormalization(value: unknown): boolean {
  return typeof value === 'string' && STATISTICS_NORMALIZATION.has(value);
}

/**
 * Per-instance `relTol` / `absTol`: activated factories read the functions singleton
 * config, so instance `config()` updates run under {@link mathFunctions.runWithConfig}.
 */
export function withCompatInstanceConfig(
  fn: (...args: unknown[]) => unknown,
  getConfig: () => Parameters<typeof mathFunctions.runWithConfig>[0],
  usesOverlay: () => boolean
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    const invoke = (): unknown => fn(...args);
    return usesOverlay() ? mathFunctions.runWithConfig(getConfig(), invoke) : invoke();
  });
}

/** Reads {@link mathFunctions.config} on each property access (instance `config()` updates). */
function createLiveConfigProxy(): { relTol: number; absTol: number } {
  return new Proxy({} as { relTol: number; absTol: number }, {
    get(_target, prop: string) {
      const cfg = mathFunctions.config() as unknown as Record<string, unknown>;
      return cfg[prop];
    },
  });
}

/**
 * Relational surface wired through activated mathjs factories (`relTol`, strict
 * `null` / `undefined`, and unit routing) before {@link applyUnitRelationalParity}.
 */
export interface CompatRelationalMatrixCtors {
  DenseMatrix: new (...args: unknown[]) => unknown;
  SparseMatrix: new (...args: unknown[]) => unknown;
}

export function createCompatRelationalOps(
  convertForeignScalar: (v: unknown) => unknown,
  matrixCtors?: CompatRelationalMatrixCtors
): UnitRelationalOps {
  const denseCtor = matrixCtors?.DenseMatrix ?? DenseMatrix;
  const sparseCtor = matrixCtors?.SparseMatrix ?? SparseMatrix;
  const typed = mathFunctions.factory_mathjsCompat.createCompatTyped() as unknown as TypedFunction;
  const config = createLiveConfigProxy();
  const equalScalar = createEqualScalar({
    typed,
    config,
  } as Parameters<typeof createEqualScalar>[0]);
  const unequal = createUnequal({
    typed,
    equalScalar,
    matrix: mathFunctions.matrix,
    DenseMatrix: denseCtor,
    SparseMatrix: sparseCtor,
  } as Parameters<typeof createUnequal>[0]);
  const deepEqual = createDeepEqual({
    typed,
    equal: factory_equal,
  } as Parameters<typeof createDeepEqual>[0]);
  const base: UnitRelationalOps = {
    equal: factory_equal as UnitRelationalOps['equal'],
    unequal: unequal as UnitRelationalOps['unequal'],
    equalScalar: equalScalar as UnitRelationalOps['equalScalar'],
    deepEqual: deepEqual as UnitRelationalOps['deepEqual'],
    compare: factory_compare as UnitRelationalOps['compare'],
    larger: factory_larger as UnitRelationalOps['larger'],
    smaller: factory_smaller as UnitRelationalOps['smaller'],
    largerEq: factory_largerEq as UnitRelationalOps['largerEq'],
    smallerEq: factory_smallerEq as UnitRelationalOps['smallerEq'],
  };
  const parity = applyUnitRelationalParity(base);
  const isCollection = (value: unknown): boolean =>
    Array.isArray(value) ||
    (typeof value === 'object' && value !== null && isMatrixLikeValue(value));
  const useParityRelational = (x: unknown, y: unknown): boolean =>
    isUnit(x) || isUnit(y) || isCollection(x) || isCollection(y);
  const withFactoryScalars = (
    parityFn: (...args: unknown[]) => unknown,
    factoryFn: (...args: unknown[]) => unknown
  ): ((...args: unknown[]) => unknown) =>
    keepSurface(parityFn, (x: unknown, y: unknown): unknown => {
      if (useParityRelational(x, y)) {
        return (parityFn as (a: unknown, b: unknown) => unknown)(x, y);
      }
      return factoryFn(x, y);
    });
  const factoryEqualCore = factory_equal as (...args: unknown[]) => unknown;
  const equal = withFactoryScalars(parity.equal, factoryEqualCore);
  const equalUnequal = withFactoryScalars(
    parity.unequal,
    (x: unknown, y: unknown) => !factoryEqualCore(x, y)
  );
  const compareCore = withFactoryScalars(
    parity.compare,
    factory_compare as (...args: unknown[]) => unknown
  );
  return {
    equal,
    unequal: equalUnequal,
    equalScalar: parity.equalScalar,
    deepEqual: parity.deepEqual,
    compare: createCompatCompare(compareCore, convertForeignScalar) as UnitRelationalOps['compare'],
    larger: withFactoryScalars(parity.larger, factory_larger as (...args: unknown[]) => unknown),
    smaller: withFactoryScalars(parity.smaller, factory_smaller as (...args: unknown[]) => unknown),
    largerEq: withFactoryScalars(
      parity.largerEq,
      factory_largerEq as (...args: unknown[]) => unknown
    ),
    smallerEq: withFactoryScalars(
      parity.smallerEq,
      factory_smallerEq as (...args: unknown[]) => unknown
    ),
  };
}

/** mathjs typed-function arity for binary relational exports. */
export function withRelationalBinaryArity(
  name: string,
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    if (args.length < 2) {
      throw tooFewArgumentsError(name, args.length === 0 ? 0 : args.length);
    }
    if (args.length > 2) {
      throw tooManyArgumentsError(name, 2, args.length);
    }
    return fn(...args);
  });
}

/**
 * `compareNatural` wired through the activated `compare` factory (`relTol`) instead
 * of the typed dispatch export (which ignores tolerance).
 */
export function createCompatCompareNatural(): (...args: unknown[]) => unknown {
  const typed = mathFunctions.factory_mathjsCompat.createCompatTyped() as unknown as TypedFunction;
  return createCompareNatural({
    typed,
    compare: factory_compare as unknown as TypedFunction,
  } as Parameters<typeof createCompareNatural>[0]) as (...args: unknown[]) => unknown;
}

function isSparseMatrixStorage(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { isSparseMatrix?: boolean }).isSparseMatrix === true
  );
}

/**
 * mathjs rejects `compareText('A', matrix[['A',...]])` with a conversion error
 * (matrix path compares as numbers first).
 */
export function withCompareTextInvalidMix(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (x: unknown, y: unknown): unknown => {
    if (
      typeof x === 'string' &&
      isSparseMatrixStorage(y) &&
      Number.isNaN(Number(x)) &&
      x.trim() !== ''
    ) {
      throw new Error(`Cannot convert "${x}" to a number`);
    }
    if (
      typeof y === 'string' &&
      isSparseMatrixStorage(x) &&
      Number.isNaN(Number(y)) &&
      y.trim() !== ''
    ) {
      throw new Error(`Cannot convert "${y}" to a number`);
    }
    return fn(x, y);
  });
}

/** mathjs `equalText` rejects BigNumber operands with a typed-function error. */
export function withEqualTextBigNumberRejection(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  const isBigNumber = mathFunctions.isBigNumber as (x: unknown) => boolean;
  return keepSurface(fn, (x: unknown, y: unknown): unknown => {
    if (isBigNumber(x) || isBigNumber(y)) {
      throw new TypeError(
        `Unexpected type of argument in function equalText (expected: string or Array or Matrix, actual: BigNumber, index: ${
          isBigNumber(x) ? 0 : 1
        })`
      );
    }
    return fn(x, y);
  });
}

/** Remap MathTS unit mismatch messages to mathjs 15.3.0 wording. */
export function remapStatisticsUnitError(err: unknown): never {
  if (
    err instanceof Error &&
    (err.message.includes('different dimensions') ||
      err.message.includes('Cannot add/subtract units'))
  ) {
    throw new Error('Units do not match');
  }
  throw err;
}

/** Walk numeric leaves; true when any plain number is NaN. */
export function statisticsContainsNaN(args: unknown[]): boolean {
  let found = false;
  const walk = (value: unknown): void => {
    if (found) return;
    if (typeof value === 'number') {
      if (Number.isNaN(value)) found = true;
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (isMatrixLikeValue(value)) {
      const m = value as { toArray?: () => unknown };
      if (typeof m.toArray === 'function') walk(m.toArray());
    }
  };
  for (const arg of args) walk(arg);
  return found;
}

function applyUnaryLike(fn: UnaryLike, args: unknown[]): unknown {
  return (fn as (...a: unknown[]) => unknown)(...args);
}

/**
 * Wrap `std` / `variance`: NaN inputs return NaN (mathjs path), and remap errors
 * thrown by the activated factories.
 */
export function withStdVarianceMathjsParity(
  name: 'std' | 'variance',
  inner: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(inner, (...args: unknown[]): unknown => {
    if (args.length === 0) {
      throw new TypeError(`Too few arguments in function ${name} (expected: any, index: 0)`);
    }
    if (statisticsContainsNaN(args)) return Number.NaN;
    for (const arg of args) {
      if (isStatisticsNormalization(arg)) continue;
      if (typeof arg === 'string' && (arg.trim() === '' || Number.isNaN(Number(arg)))) {
        if (args.length === 1 && !Array.isArray(arg)) {
          throw invalidNumericStringError(arg);
        }
        throw new Error(`Cannot convert "${arg}" to a number`);
      }
    }
    if (args.length === 1 && Array.isArray(args[0]) && (args[0] as unknown[]).length === 0) {
      throw statisticsEmptyParametersError(name);
    }
    try {
      return inner(...args);
    } catch (err) {
      if (err instanceof Error) {
        if (
          name === 'std' &&
          args.length === 2 &&
          typeof args[1] === 'string' &&
          err.message.includes('Cannot convert')
        ) {
          throw new Error(
            'Unknown normalization "' +
              String(args[1]) +
              '". Choose "unbiased" (default), "uncorrected", or "biased".'
          );
        }
        if (
          err instanceof RangeError &&
          err.message.includes('dim') &&
          err.message.includes('out of range')
        ) {
          throw new Error(`Index out of range (0 <= dim <= 1)`);
        }
        if (
          err.message.includes('different dimensions') ||
          err.message.includes('Cannot add/subtract units')
        ) {
          remapStatisticsUnitError(err);
        }
        if (err.message.includes('Unexpected type of argument in function std')) {
          throw new TypeError(
            err.message.replace(
              /Unexpected type of argument in function std/,
              'Cannot calculate std, unexpected type of argument'
            )
          );
        }
        if (err.message.includes('Unexpected type of argument in function variance')) {
          throw new TypeError(
            err.message.replace(
              /Unexpected type of argument in function variance/,
              'Cannot calculate variance, unexpected type of argument'
            )
          );
        }
      }
      throw err;
    }
  });
}

/** Factory `mean` with mathjs error surfaces and unit mismatch wording. */
export function withMeanMathjsParity(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return withStatisticsMultiCollectionGuard(
    keepSurface(fn, (...args: unknown[]): unknown => {
      if (args.length === 0) {
        throw statisticsEmptyParametersError('mean');
      }
      try {
        return fn(...args);
      } catch (err) {
        if (err instanceof Error) {
          if (
            err.message.includes('different dimensions') ||
            err.message.includes('Cannot add/subtract units')
          ) {
            remapStatisticsUnitError(err);
          }
          if (err instanceof RangeError && err.message.includes('dim')) {
            const dim = args[1];
            const negative =
              typeof dim === 'number'
                ? dim < 0
                : typeof dim === 'object' &&
                  dim !== null &&
                  typeof (dim as { toNumber?: () => number }).toNumber === 'function' &&
                  (dim as { toNumber: () => number }).toNumber() < 0;
            if (negative) {
              throw new Error('IndexError: Index out of range (0 <= index < dimension)');
            }
          }
          if (
            err.message.includes('Unexpected type of argument') ||
            err.message.includes('unexpected type')
          ) {
            throw new TypeError('Cannot calculate mean, unexpected type of argument');
          }
        }
        throw err;
      }
    })
  );
}

/** mathjs 15.3.0 rejects `median(A, dim)` (MathTS supports dim natively). */
export function withMedianMathjsParity(
  median: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(median, (...args: unknown[]): unknown => {
    if (args.length >= 2) {
      const dim = args[1];
      const collection =
        Array.isArray(args[0]) ||
        (typeof args[0] === 'object' && args[0] !== null && isMatrixLikeValue(args[0]));
      const looksLikeDim =
        typeof dim === 'number' ||
        (typeof dim === 'object' &&
          dim !== null &&
          (dim as { isBigNumber?: boolean }).isBigNumber === true);
      if (collection && looksLikeDim) {
        throw new Error('median(A, dim) is not yet supported');
      }
    }
    if (args.length === 1 && Array.isArray(args[0]) && (args[0] as unknown[]).length === 0) {
      throw new Error('Cannot calculate median of an empty array');
    }
    try {
      return median(...args);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unexpected type of argument')) {
        throw new TypeError('Cannot calculate median, unexpected type of argument');
      }
      throw err;
    }
  });
}

/** mathjs 15.3.0 rejects `prod(A, dim)`. */
export function withProdDimUnsupported(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    if (args.length >= 2) {
      const dim = args[1];
      const collection =
        Array.isArray(args[0]) ||
        (typeof args[0] === 'object' && args[0] !== null && isMatrixLikeValue(args[0]));
      if (
        collection &&
        (typeof dim === 'number' ||
          (typeof dim === 'object' &&
            dim !== null &&
            (dim as { isBigNumber?: boolean }).isBigNumber))
      ) {
        throw new Error('prod(A, dim) is not yet supported');
      }
    }
    try {
      return fn(...args);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unexpected type of argument')) {
        throw new TypeError('Cannot calculate prod, unexpected type of argument');
      }
      throw err;
    }
  });
}

export function withMadInvalidTypeGuard(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    try {
      return fn(...args);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes('Unexpected type of argument in function mad')
      ) {
        throw new TypeError(
          err.message.replace(
            /Unexpected type of argument in function mad/,
            'Cannot calculate mad, unexpected type of argument'
          )
        );
      }
      throw err;
    }
  });
}

export function withCumsumMathjsParity(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    try {
      return fn(...args);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes('Unexpected type of argument in function cumsum')
      ) {
        throw new TypeError(
          err.message.replace(
            /Unexpected type of argument in function cumsum/,
            'Cannot calculate cumsum, unexpected type of argument'
          )
        );
      }
      throw err;
    }
  });
}

export function withModeEmptyGuard(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    if (args.length === 0) {
      throw statisticsEmptyParametersError('mode');
    }
    return fn(...args);
  });
}

export function withSumEmptyArrayZero(
  fn: (...args: unknown[]) => unknown,
  getNumberMode: () => string,
  BnCtor: new (v: string | number) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    if (args.length === 1 && Array.isArray(args[0]) && (args[0] as unknown[]).length === 0) {
      if (getNumberMode() === 'BigNumber') return new BnCtor(0);
      return 0;
    }
    try {
      return fn(...args);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes('Unexpected type of argument in function sum')
      ) {
        throw new TypeError(
          err.message.replace(
            /Unexpected type of argument in function sum/,
            'Cannot calculate sum, unexpected type of argument'
          )
        );
      }
      throw err;
    }
  });
}

/** Bigint config median returns bigint for integer inputs. */
export function withMedianBigintReturn(
  median: (...args: unknown[]) => unknown,
  getNumberMode: () => string
): (...args: unknown[]) => unknown {
  return keepSurface(median, (...args: unknown[]): unknown => {
    const result = median(...args);
    if (getNumberMode() !== 'bigint') return result;
    const allBigint = args.length > 1 && args.every((a) => typeof a === 'bigint');
    if (allBigint && typeof result === 'bigint') return result;
    if (
      allBigint &&
      typeof result === 'object' &&
      result !== null &&
      (result as { isFraction?: boolean }).isFraction === true
    ) {
      const f = result as { valueOf: () => number };
      const n = f.valueOf();
      if (Number.isInteger(n)) return BigInt(n);
    }
    return result;
  });
}

interface MathjsCorrDeps {
  matrix: (data: unknown) => unknown;
  add: (...args: unknown[]) => unknown;
  subtract: (a: unknown, b: unknown) => unknown;
  multiply: (...args: unknown[]) => unknown;
  divide: (a: unknown, b: unknown) => unknown;
  pow: (a: unknown, b: unknown) => unknown;
  sqrt: (x: unknown) => unknown;
  sum: (...args: unknown[]) => unknown;
}

/**
 * mathjs 15.3.0 `corr` uses the textbook sum formula (not MathTS's pairwise-stable
 * path) so oracle unit tests match bitwise.
 */
export function createCompatMathjsCorr(deps: MathjsCorrDeps): (...args: unknown[]) => unknown {
  const { matrix, sqrt, sum, add, subtract, multiply, pow, divide } = deps;

  function correlation(A: unknown[], B: unknown[]): unknown {
    const n = A.length;
    const sumX = applyUnaryLike(sum as UnaryLike, [A]);
    const sumY = applyUnaryLike(sum as UnaryLike, [B]);
    let sumXY: unknown = undefined;
    for (let i = 0; i < n; i++) {
      const term = multiply(A[i], B[i]);
      sumXY = sumXY === undefined ? term : add(sumXY, term);
    }
    const sumXSquare = applyUnaryLike(sum as UnaryLike, [A.map((x) => pow(x, 2))]);
    const sumYSquare = applyUnaryLike(sum as UnaryLike, [B.map((y) => pow(y, 2))]);
    const numerator = subtract(multiply(n, sumXY), multiply(sumX, sumY));
    const denominator = sqrt(
      multiply(
        subtract(multiply(n, sumXSquare), pow(sumX, 2)),
        subtract(multiply(n, sumYSquare), pow(sumY, 2))
      )
    );
    return divide(numerator, denominator);
  }

  function corrArrays(A: unknown[], B: unknown[]): unknown {
    if (Array.isArray(A[0]) && Array.isArray(B[0])) {
      if (A.length !== B.length) {
        throw new SyntaxError('Dimension mismatch. Array A and B must have the same length.');
      }
      const out: unknown[] = [];
      for (let i = 0; i < A.length; i++) {
        const rowA = A[i] as unknown[];
        const rowB = B[i] as unknown[];
        if (rowA.length !== rowB.length) {
          throw new SyntaxError(
            'Dimension mismatch. Array A and B must have the same number of elements.'
          );
        }
        out.push(correlation(rowA, rowB));
      }
      return out;
    }
    if (A.length !== B.length) {
      throw new SyntaxError(
        'Dimension mismatch. Array A and B must have the same number of elements.'
      );
    }
    return correlation(A, B);
  }

  return function compatCorr(A: unknown, B: unknown): unknown {
    const matrixLike = (x: unknown): x is { toArray: () => unknown[] } =>
      typeof x === 'object' &&
      x !== null &&
      typeof (x as { toArray?: unknown }).toArray === 'function';
    if (matrixLike(A) && matrixLike(B)) {
      const res = corrArrays(A.toArray(), B.toArray());
      return Array.isArray(res) ? matrix(res) : res;
    }
    return corrArrays(A as unknown[], B as unknown[]);
  };
}

/** Activated statistics factories for the compat instance (#1788). */
export const compatStatisticsFactories = {
  mean: factory_mean as (...args: unknown[]) => unknown,
  std: factory_std as (...args: unknown[]) => unknown,
  variance: factory_variance as (...args: unknown[]) => unknown,
  max: factory_max as (...args: unknown[]) => unknown,
  min: factory_min as (...args: unknown[]) => unknown,
  sum: factory_sum as (...args: unknown[]) => unknown,
  cumsum: factory_cumsum as (...args: unknown[]) => unknown,
  quantileSeq: factoryQuantileSeq as (...args: unknown[]) => unknown,
  corr: factoryCorr as (...args: unknown[]) => unknown,
} as const;
