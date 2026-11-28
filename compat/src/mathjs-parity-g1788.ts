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
  median as factoryMedian,
} from '@danielsimonjr/mathts-functions';
import { promoteBooleanScalarsForBigNumber, BigNumber as CompatBigNumberCtor } from './bignumber.js';
import { isMathjsFraction, mathjsFractionClass } from './mathjs-fraction-class.js';
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
  isOwnBigNumber,
  isBigNumberLike,
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
  const normalizeFractionBigintPair = (x: unknown, y: unknown): [unknown, unknown] => {
    const hasFraction = isMathjsFraction(x) || isMathjsFraction(y);
    const hasBigint = typeof x === 'bigint' || typeof y === 'bigint';
    if (!hasFraction || !hasBigint) return [x, y];
    return [
      typeof x === 'bigint' ? Number(x) : x,
      typeof y === 'bigint' ? Number(y) : y,
    ];
  };
  const withFactoryScalars = (
    parityFn: (...args: unknown[]) => unknown,
    factoryFn: (...args: unknown[]) => unknown,
    shouldUseParity: (x: unknown, y: unknown) => boolean = useParityRelational
  ): ((...args: unknown[]) => unknown) =>
    keepSurface(parityFn, (x: unknown, y: unknown): unknown => {
      if (shouldUseParity(x, y)) {
        return (parityFn as (a: unknown, b: unknown) => unknown)(x, y);
      }
      const [nx, ny] = normalizeFractionBigintPair(x, y);
      return factoryFn(nx, ny);
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
/** mathjs `compareNatural` compares same-type bigints without `_compareNatural`'s type table. */
function relationalSignFromCompare(compare: (...args: unknown[]) => unknown, x: unknown, y: unknown): number {
  const result = compare(x, y);
  if (typeof result === 'number') return result;
  if (
    typeof result === 'object' &&
    result !== null &&
    typeof (result as { valueOf?: () => number }).valueOf === 'function'
  ) {
    return (result as { valueOf: () => number }).valueOf();
  }
  return Number(result);
}

/** Factory `largerEq`/`smallerEq` mishandle mathjs `Fraction` scalars; compare instead (#1788). */
export function withFractionScalarOrdering(
  kind: 'largerEq' | 'smallerEq',
  compare: (...args: unknown[]) => unknown,
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (x: unknown, y: unknown): unknown => {
    const mixedFractionScalar =
      (isMathjsFraction(x) && !isMathjsFraction(y)) ||
      (isMathjsFraction(y) && !isMathjsFraction(x));
    if (mixedFractionScalar) {
      const [nx, ny] =
        typeof x === 'bigint' || typeof y === 'bigint'
          ? [
              typeof x === 'bigint' ? Number(x) : x,
              typeof y === 'bigint' ? Number(y) : y,
            ]
          : [x, y];
      const sign = relationalSignFromCompare(compare, nx, ny);
      return kind === 'largerEq' ? sign <= 0 : sign >= 0;
    }
    return fn(x, y);
  });
}

export function withCompareNaturalBigintParity(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (x: unknown, y: unknown): unknown => {
    if (typeof x === 'bigint' && typeof y === 'bigint') {
      return x < y ? -1 : x > y ? 1 : 0;
    }
    return fn(x, y);
  });
}

export function createCompatCompareNatural(
  compare: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  const typed = mathFunctions.factory_mathjsCompat.createCompatTyped() as unknown as TypedFunction;
  const inner = createCompareNatural({
    typed,
    compare: compare as unknown as TypedFunction,
  } as Parameters<typeof createCompareNatural>[0]) as (...args: unknown[]) => unknown;
  return keepSurface(inner, (x: unknown, y: unknown): unknown => {
    const result = inner(x, y);
    if (typeof result === 'number') return result;
    if (isBigNumberLike(result) || isOwnBigNumber(result)) {
      const n = (result as { toNumber?: () => number; valueOf: () => unknown }).toNumber?.();
      if (typeof n === 'number') return n;
      const valueOf = (result as { valueOf: () => unknown }).valueOf();
      return typeof valueOf === 'number' ? valueOf : Number(valueOf);
    }
    if (
      typeof result === 'object' &&
      result !== null &&
      typeof (result as { valueOf?: () => number }).valueOf === 'function'
    ) {
      return (result as { valueOf: () => number }).valueOf();
    }
    return result;
  });
}

type InstanceBigNumberCtor = new (value: string | number) => unknown;

/** Promote compare / ordering sign results to the instance BigNumber type (mathjs `compare(bn,bn)`). */
export function withCompareInstanceBigNumberResult(
  compare: (...args: unknown[]) => unknown,
  BigNumberCtor: InstanceBigNumberCtor
): (...args: unknown[]) => unknown {
  return keepSurface(compare, (x: unknown, y: unknown): unknown => {
    const promoted = promoteBooleanScalarsForBigNumber(
      [x, y],
      BigNumberCtor as unknown as typeof CompatBigNumberCtor
    );
    const result = compare(promoted[0], promoted[1]);
    const usesBigNumber =
      isOwnBigNumber(x) ||
      isOwnBigNumber(y) ||
      isBigNumberLike(x) ||
      isBigNumberLike(y) ||
      isOwnBigNumber(promoted[0]) ||
      isOwnBigNumber(promoted[1]);
    if (!usesBigNumber) return result;
    if (result instanceof BigNumberCtor) return result;
    if (
      typeof result === 'number' &&
      (Number.isFinite(result) || Number.isNaN(result) || result === 0)
    ) {
      return new BigNumberCtor(result);
    }
    if (
      typeof result === 'object' &&
      result !== null &&
      (result as { isFraction?: boolean }).isFraction === true
    ) {
      const valueOf = (result as { valueOf: () => number }).valueOf();
      return new BigNumberCtor(valueOf);
    }
    if (isBigNumberLike(result) || isOwnBigNumber(result)) {
      return new BigNumberCtor((result as { toString(): string }).toString());
    }
    return result;
  });
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
  return keepSurface(fn, (x: unknown, y: unknown): unknown => {
    if (isOwnBigNumber(x) || isOwnBigNumber(y) || isBigNumberLike(x) || isBigNumberLike(y)) {
      throw new TypeError(
        `Unexpected type of argument in function compareText (expected: string or Array or Matrix, actual: BigNumber, index: ${
          isOwnBigNumber(x) || isBigNumberLike(x) ? 0 : 1
        })`
      );
    }
    return fn(x, y);
  });
}

/** Same sparse/string conversion guard as {@link withCompareTextInvalidMix}. */
export function withEqualTextInvalidMix(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return withCompareTextInvalidMix(fn);
}

function remapInvalidNumericString(err: unknown): never {
  if (err instanceof SyntaxError && err.message.includes('is not a valid number')) {
    const match = /String "([^"]*)"/.exec(err.message);
    const literal = match?.[1] ?? '';
    throw new Error(`Cannot convert "${literal}" to a number`);
  }
  throw err;
}

/** Map factory type errors to mathjs 15.3.0 statistics wording. */
export function remapStatisticsFactoryError(err: unknown, calcName: string): never {
  if (!(err instanceof Error)) throw err;
  if (err.message.includes('is not a valid number')) {
    remapInvalidNumericString(err);
  }
  if (
    err.message.includes('add: unexpected type') ||
    err.message.includes('Unexpected type of argument in function ' + calcName) ||
    (err.message.includes('Unexpected type of argument') && calcName !== '')
  ) {
    throw new TypeError(`Cannot calculate ${calcName}, unexpected type of argument`);
  }
  throw err;
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
        if (err.message.includes('add: unexpected type')) {
          throw new TypeError('Cannot calculate std, unexpected type of argument');
        }
        if (err.message.includes('Unexpected type of argument in function std')) {
          throw new TypeError(
            err.message.replace(
              /Unexpected type of argument in function std/,
              'Cannot calculate std, unexpected type of argument'
            )
          );
        }
        if (err.message.includes('add: unexpected type')) {
          throw new TypeError('Cannot calculate variance, unexpected type of argument');
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
          if (err.message.includes('is not a valid number')) {
            remapInvalidNumericString(err);
          }
          if (err.message.includes('add: unexpected type')) {
            throw new TypeError('Cannot calculate mean, unexpected type of argument');
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
      if (err instanceof Error) {
        if (err.message.includes('Invalid argument')) {
          throw err;
        }
        if (
          err.message.includes('Unexpected type of argument') ||
          err.message.includes('add: unexpected type')
        ) {
          throw new TypeError('Cannot calculate median, unexpected type of argument');
        }
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
      if (err instanceof Error) {
        if (
          err.message.includes('Unexpected type of argument') ||
          err.message.includes('add: unexpected type')
        ) {
          throw new TypeError('Cannot calculate prod, unexpected type of argument');
        }
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
      if (err instanceof Error) {
        if (err.message.includes('add: unexpected type')) {
          throw new TypeError('Cannot calculate mad, unexpected type of argument');
        }
        if (err.message.includes('Unexpected type of argument in function mad')) {
          throw new TypeError(
            err.message.replace(
              /Unexpected type of argument in function mad/,
              'Cannot calculate mad, unexpected type of argument'
            )
          );
        }
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
      if (err instanceof Error) {
        if (err.message.includes('add: unexpected type')) {
          throw new TypeError('Cannot calculate cumsum, unexpected type of argument');
        }
        if (err.message.includes('Unexpected type of argument in function cumsum')) {
          throw new TypeError(
            err.message.replace(
              /Unexpected type of argument in function cumsum/,
              'Cannot calculate cumsum, unexpected type of argument'
            )
          );
        }
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
      const mode = getNumberMode();
      if (mode === 'BigNumber') return new BnCtor(0);
      if (mode === 'Fraction') return new mathjsFractionClass(0);
      if (mode === 'bigint') return 0n;
      return 0;
    }
    try {
      return fn(...args);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('is not a valid number')) {
          remapInvalidNumericString(err);
        }
        if (
          err.message.includes('add: unexpected type') ||
          err.message.includes('Unexpected type of argument in function sum')
        ) {
          throw new TypeError('Cannot calculate sum, unexpected type of argument');
        }
      }
      throw err;
    }
  });
}

/** Bigint config median returns bigint for integer inputs. */
export function withMedianMathjsFractionReturn(
  median: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  const usesMathjsFraction = (args: unknown[]): boolean => {
    const walk = (v: unknown): boolean => {
      if (isMathjsFraction(v)) return true;
      if (Array.isArray(v)) return v.some(walk);
      return false;
    };
    return args.some(walk);
  };
  return keepSurface(median, (...args: unknown[]): unknown => {
    const result = median(...args);
    if (!usesMathjsFraction(args)) return result;
    if (isMathjsFraction(result)) return result;
    if (
      typeof result === 'object' &&
      result !== null &&
      typeof (result as { s?: bigint; n?: bigint; d?: bigint }).n === 'bigint'
    ) {
      const f = result as { s: bigint; n: bigint; d: bigint };
      return new mathjsFractionClass(Number(f.s * f.n), Number(f.d));
    }
    return result;
  });
}

export function withMedianBigintReturn(
  median: (...args: unknown[]) => unknown,
  getNumberMode: () => string
): (...args: unknown[]) => unknown {
  const isAllBigintInput = (values: unknown[]): boolean => {
    if (values.length === 0) return false;
    if (values.length === 1 && Array.isArray(values[0])) {
      return (values[0] as unknown[]).every((v) => typeof v === 'bigint');
    }
    return values.every((v) => typeof v === 'bigint');
  };
  return keepSurface(median, (...args: unknown[]): unknown => {
    const result = median(...args);
    const allBigint = isAllBigintInput(args);
    if (!allBigint && getNumberMode() !== 'bigint') return result;
    if (allBigint && typeof result === 'bigint') return result;
    if (allBigint && typeof result === 'object' && result !== null) {
      const f = result as { s?: bigint; n?: bigint; valueOf?: () => number; type?: string };
      if (typeof f.s === 'bigint' && typeof f.n === 'bigint' && f.s === 1n) {
        return f.n;
      }
      if (typeof f.valueOf === 'function') {
        const n = f.valueOf();
        if (Number.isInteger(n)) return BigInt(n);
      }
    }
    return result;
  });
}

function valueOfFlat(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    const out: unknown[] = [];
    const stack: unknown[] = [data];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (Array.isArray(cur)) {
        for (let i = cur.length - 1; i >= 0; i--) stack.push(cur[i]);
      } else {
        out.push(cur);
      }
    }
    return out.reverse();
  }
  if (typeof data === 'object' && data !== null && typeof (data as { valueOf?: unknown }).valueOf === 'function') {
    const raw = (data as { valueOf: () => unknown }).valueOf();
    return valueOfFlat(raw);
  }
  return [data];
}

interface MathjsQuantileDeps {
  partitionSelect: (arr: unknown[], k: number) => unknown;
  compare: (a: unknown, b: unknown) => number;
  add: (...args: unknown[]) => unknown;
  subtract: (a: unknown, b: unknown) => unknown;
  multiply: (...args: unknown[]) => unknown;
  smaller: (a: unknown, b: unknown) => boolean;
  smallerEq: (a: unknown, b: unknown) => boolean;
  larger: (a: unknown, b: unknown) => boolean;
  isInteger: (x: unknown) => boolean;
  mapSlices: (data: unknown, dim: number, fn: (slice: unknown) => unknown) => unknown;
  bignumber: (x: unknown) => unknown;
}

function mathjsQuantileInterp(
  flat: unknown[],
  prob: number,
  sorted: boolean,
  deps: MathjsQuantileDeps
): unknown {
  const len = flat.length;
  if (len === 0) throw new Error('Cannot calculate quantile of an empty sequence');
  const index = prob * (len - 1);
  const integerPart = Math.floor(index);
  const fracPart = index % 1;
  if (Number.isInteger(index)) {
    return sorted
      ? flat[index]
      : deps.partitionSelect(flat.slice(), integerPart);
  }
  let left: unknown;
  let right: unknown;
  if (sorted) {
    left = flat[integerPart];
    right = flat[integerPart + 1];
  } else {
    const scratch = flat.slice();
    right = deps.partitionSelect(scratch, integerPart + 1);
    left = scratch[integerPart];
    for (let i = 0; i < integerPart; ++i) {
      if (deps.compare(scratch[i], left) > 0) left = scratch[i];
    }
  }
  const oneMinus = deps.subtract(1, fracPart);
  return deps.add(
    deps.multiply(left, oneMinus),
    deps.multiply(right, fracPart)
  );
}

function probNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (isOwnBigNumber(value) || isBigNumberLike(value)) {
    return (value as { toNumber?: () => number }).toNumber?.() ??
      Number((value as { toString(): string }).toString());
  }
  return Number(value);
}

function coerceQuantileBigNumbers(
  value: unknown,
  BigNumberCtor: InstanceBigNumberCtor,
  wantsBigNumber: boolean
): unknown {
  if (!wantsBigNumber) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => coerceQuantileBigNumbers(entry, BigNumberCtor, wantsBigNumber));
  }
  if (value instanceof BigNumberCtor) return value;
  if (isBigNumberLike(value) || isOwnBigNumber(value)) {
    return new BigNumberCtor((value as { toString(): string }).toString());
  }
  if (typeof value === 'number') return new BigNumberCtor(value);
  return value;
}

/**
 * mathjs 15.3.0 `quantileSeq` for dim slices and BigNumber probability coercion
 * (#1788); other signatures fall through to the activated factory.
 */
export function createCompatMathjsQuantileSeq(
  native: (...args: unknown[]) => unknown,
  deps: MathjsQuantileDeps,
  BigNumberCtor: InstanceBigNumberCtor
): (...args: unknown[]) => unknown {
  const wantsBigNumberArg = (args: unknown[]): boolean =>
    args.some((a) => isOwnBigNumber(a) || isBigNumberLike(a));
  const runMathjsDim = (
    data: unknown,
    prob: unknown,
    sorted: boolean,
    dim: number
  ): unknown => {
    const p = probNumber(prob);
    const fn = (slice: unknown): unknown => {
      const flat = valueOfFlat(slice);
      const value = mathjsQuantileInterp(flat, p, sorted, deps);
      return wantsBigNumberArg([prob]) ? deps.bignumber(value) : value;
    };
    return deps.mapSlices(data, dim, fn);
  };

  return keepSurface(native, (...args: unknown[]): unknown => {
    const wantsBn = wantsBigNumberArg(args);
    const isProb = (x: unknown): boolean =>
      typeof x === 'number' || isOwnBigNumber(x) || isBigNumberLike(x);
    const isDim = (x: unknown): boolean => typeof x === 'number' && Number.isInteger(x);
    const isSorted = (x: unknown): x is boolean => typeof x === 'boolean';

    try {
      if (args.length === 3 && isProb(args[1]) && isDim(args[2])) {
        const sorted = false;
        const out = runMathjsDim(args[0], args[1], sorted, args[2] as number);
        return coerceQuantileBigNumbers(out, BigNumberCtor, wantsBn);
      }
      if (args.length === 4 && isProb(args[1]) && isSorted(args[2]) && isDim(args[3])) {
        const out = runMathjsDim(args[0], args[1], args[2], args[3] as number);
        return coerceQuantileBigNumbers(out, BigNumberCtor, wantsBn);
      }
      if (
        args.length === 2 &&
        Array.isArray(args[1]) &&
        wantsBn
      ) {
        const flat = valueOfFlat(args[0]);
        const probs = args[1] as unknown[];
        const out = probs.map((p) => {
          const v = mathjsQuantileInterp(flat, probNumber(p), false, deps);
          return deps.bignumber(v);
        });
        return coerceQuantileBigNumbers(out, BigNumberCtor, true);
      }
      if (args.length === 2 && isProb(args[1]) && (isOwnBigNumber(args[1]) || isBigNumberLike(args[1]))) {
        const flat = valueOfFlat(args[0]);
        const p = probNumber(args[1]);
        const out = mathjsQuantileInterp(flat, p, false, deps);
        return coerceQuantileBigNumbers(deps.bignumber(out), BigNumberCtor, true);
      }
      if (
        args.length === 2 &&
        isProb(args[1]) &&
        largerProbOne(args[1], deps)
      ) {
        const flat = valueOfFlat(args[0]);
        const n = probNumber(args[1]);
        const probs: unknown[] = [];
        for (let i = 0; i < n; i++) {
          const prob = (i + 1) / (n + 1);
          probs.push(
            wantsBn
              ? deps.bignumber(mathjsQuantileInterp(flat, prob, false, deps))
              : mathjsQuantileInterp(flat, prob, false, deps)
          );
        }
        return coerceQuantileBigNumbers(probs, BigNumberCtor, wantsBn);
      }
      const out = native(...args);
      return coerceQuantileBigNumbers(out, BigNumberCtor, wantsBn);
    } catch (err) {
      remapStatisticsFactoryError(err, 'quantileSeq');
    }
  });
}

function largerProbOne(prob: unknown, deps: MathjsQuantileDeps): boolean {
  if (typeof prob === 'number') return prob > 1;
  return deps.larger(prob, 1);
}

/** Activated `median` factory on the compat instance (#1788). */
export const compatMedianFactory = factoryMedian as (...args: unknown[]) => unknown;

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
