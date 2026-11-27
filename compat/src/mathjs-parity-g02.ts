/**
 * G02 — mathjs-parity adapters over the mathjs-shaped factories (#1550, #1583,
 * #1587, #1588).
 *
 * Every wrapper here lives in compat on purpose: the critical libraries keep
 * their native behavior, and these adapters reproduce only what mathjs 15.3.0
 * does differently at the compat surface (arity rejections, the deliberate
 * Fraction→BigNumber conversion guard, the untyped variadic statistics
 * dispatch, the `mad` result behavior, and the `expm` Matrix return).
 */

import {
  BigNumber as CompatBigNumber,
  compatDecimalResult,
  promoteBooleanScalarsForBigNumber,
} from './bignumber.js';
import { isComplex, isFraction } from '@danielsimonjr/mathts-core';
import type { Fraction as CompatFractionType } from '@danielsimonjr/mathts-core';
import type { CompatBigNumberInstance as CompatBigNumberType } from './bignumber.js';

type UnaryLike = (...args: never[]) => unknown;

/** The compat BigNumber constructor. */
type BigNumberCtor = new (v?: number | string | bigint) => CompatBigNumberType;

type ArgPrecisionScope = (precision: number, build: () => unknown) => unknown;

/**
 * Call a concretely-typed function through the `never[]` top type for its
 * parameters (the repo's typed-dispatch convention). One cast, here only.
 */
function apply(fn: UnaryLike, args: unknown[]): unknown {
  return (fn as (...args: unknown[]) => unknown)(...args);
}

/**
 * Copy the `name` and `length` of the wrapped function onto the wrapper, so
 * instance wrappers keep the typed-function surface the isolation tests pin.
 */
export function keepSurface<T extends (...args: unknown[]) => unknown>(from: UnaryLike, to: T): T {
  try {
    Object.defineProperty(to, 'name', { value: from.name, configurable: true });
    Object.defineProperty(to, 'length', { value: from.length, configurable: true });
  } catch {
    // exotic functions may refuse a name/length redefine
  }
  for (const key of Reflect.ownKeys(from)) {
    if (key === 'prototype' || Object.prototype.hasOwnProperty.call(to, key)) continue;
    const desc = Object.getOwnPropertyDescriptor(from, key);
    if (!desc) continue;
    try {
      Object.defineProperty(to, key, desc);
    } catch {
      // skip non-configurable exotic keys
    }
  }
  return to;
}

// =============================================================================
// mathjs error messages
// =============================================================================

/** mathjs's deliberate Fraction→BigNumber conversion guard (typed-function conversion). */
export const FRACTION_TO_BIGNUMBER_ERROR =
  'Cannot implicitly convert a Fraction to BigNumber or vice versa. ' +
  'Use function bignumber(x) to convert to BigNumber or fraction(x) to convert to Fraction.';

/** mathjs typed-function "too few arguments" error (`mad()` uses index 0). */
export function tooFewArgumentsError(name: string, index = 1): TypeError {
  return new TypeError(`Too few arguments in function ${name} (expected: any, index: ${index})`);
}

/** mathjs `SyntaxError` for a non-numeric string argument. */
export function invalidNumericStringError(value: string): SyntaxError {
  return new SyntaxError(`String "${value}" is not a valid number`);
}

const COMPLEX_ORDERING_ERROR = 'no ordering relation is defined for complex numbers';

/** mathjs statistics empty-input `SyntaxError`. */
export function statisticsEmptyParametersError(name: string): SyntaxError {
  return new SyntaxError(`Function ${name} requires one or more parameters (0 provided)`);
}

/** mathjs typed-function "too many arguments" error. */
export function tooManyArgumentsError(name: string, expected: number, actual: number): TypeError {
  return new TypeError(
    `Too many arguments in function ${name} (expected: ${expected}, actual: ${actual})`
  );
}

// =============================================================================
// Duck-typed predicates for oracle (mathjs-package) values
// =============================================================================

/**
 * A fraction.js-style Fraction: the compat `isFraction` plus the foreign
 * fraction.js shape (numeric `s`, `n`, `d` fields). A foreign instance reaches
 * compat through the differential harness, which passes oracle values in.
 */
export function isFractionLike(x: unknown): boolean {
  if (isFraction(x)) return true;
  if (typeof x !== 'object' || x === null) return false;
  const f = x as { s?: unknown; n?: unknown; d?: unknown };
  const numeric = (v: unknown): boolean => typeof v === 'number' || typeof v === 'bigint';
  return numeric(f.s) && numeric(f.n) && numeric(f.d) && f.d !== 0 && f.d !== 0n;
}

/**
 * A decimal.js-style BigNumber: the foreign decimal.js shape (`Decimal`
 * constructor with the `d`/`e`/`s` fields). The compat BigNumber class is
 * named `CompatBigNumber`, so the constructor name separates the two.
 */
export function isBigNumberLike(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false;
  const b = x as { constructor?: { name?: string }; d?: unknown; s?: unknown };
  return b.constructor?.name === 'Decimal' && Array.isArray(b.d) && typeof b.s === 'number';
}

/**
 * The compat's own BigNumber. Both the compat and the foreign mathjs decimal
 * carry an `isBigNumber` prototype flag; the constructor name tells them apart
 * (the foreign one is a `Decimal` clone).
 */
export function isOwnBigNumber(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false;
  const b = x as { isBigNumber?: boolean; constructor?: { name?: string } };
  return b.isBigNumber === true && b.constructor?.name !== 'Decimal';
}

/** A complex-like value: numeric `re`/`im` fields (compat Complex or foreign). */
export function isComplexLike(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as { re?: unknown; im?: unknown };
  return typeof c.re === 'number' && typeof c.im === 'number';
}

/** A matrix-like value: an Array or a matrix with the `prototype.isMatrix` flag. */
export function isMatrixLikeValue(x: unknown): boolean {
  if (Array.isArray(x)) return true;
  if (typeof x !== 'object' || x === null) return false;
  const proto = Object.getPrototypeOf(x) as { isMatrix?: boolean } | null;
  return proto?.isMatrix === true;
}

/** Convert a foreign fraction.js Fraction to the compat Fraction. */
function toCompatFraction(
  x: unknown,
  FractionClass: new (n: bigint, d: bigint) => CompatFractionType
): CompatFractionType {
  const f = x as { s: number; n: number; d: number };
  const sign = f.s < 0 ? -1n : 1n;
  return new FractionClass(sign * BigInt(f.n), BigInt(f.d));
}

// =============================================================================
// #1587 — arity rejections
// =============================================================================

/**
 * Reject every arity but one with the mathjs typed-function error
 * (`size(2, 3)` → "Too many arguments in function size (expected: 1, actual: 2)").
 */
export function withFixedArity(
  name: string,
  expected: number,
  fn: UnaryLike
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    if (args.length < expected) {
      throw tooFewArgumentsError(name, args.length);
    }
    if (args.length > expected) {
      throw tooManyArgumentsError(name, expected, args.length);
    }
    return apply(fn, args);
  });
}

/** Reject calls with more than `max` positional arguments (mathjs overload families). */
export function withMaxArity(
  name: string,
  max: number,
  fn: UnaryLike
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    if (args.length > max) {
      throw tooManyArgumentsError(name, max, args.length);
    }
    return apply(fn, args);
  });
}

// =============================================================================
// #1587 — Fraction rejection on the trigonometric / log / exp surface
// =============================================================================

/**
 * mathjs rejects a Fraction argument on these functions through its
 * Fraction→BigNumber conversion guard; the compat conversion table instead
 * converts the Fraction silently. Reject the Fraction up front with the
 * mathjs error and delegate everything else.
 */
export function withFractionRejection(fn: UnaryLike): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    for (const arg of args) {
      if (isFractionLike(arg)) throw new TypeError(FRACTION_TO_BIGNUMBER_ERROR);
    }
    return apply(fn, args);
  });
}

// =============================================================================
// #1587 — count of a boolean is the string length
// =============================================================================

/**
 * mathjs's typed conversion `boolean -> string` makes `count(true)` the length
 * of `'true'`. The compat typed table has no boolean→string conversion, so the
 * compat `count` applies it here, at the one function the conversion reaches.
 */
export function withCountBoolean(fn: UnaryLike): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    if (args.length > 1) {
      // mathjs count takes one argument: its typed dispatch reports the
      // one-argument signature's own error first (a type error for a bad
      // value, the too-many error for a valid one), so evaluate args[0] with
      // the boolean conversion the one-argument form applies.
      const first = typeof args[0] === 'boolean' ? String(args[0]) : args[0];
      let firstOk = false;
      let firstError: unknown;
      try {
        apply(fn, [first]);
        firstOk = true;
      } catch (err) {
        firstError = err;
      }
      if (!firstOk) throw firstError;
      throw tooManyArgumentsError('count', 1, args.length);
    }
    if (args.length === 1 && typeof args[0] === 'boolean') return apply(fn, [String(args[0])]);
    return apply(fn, args);
  });
}

// =============================================================================
// #1550 — single-value statistics keep the value
// =============================================================================

/**
 * mathjs's untyped `...any` statistics rest signature returns a lone value as
 * it is: `sum(true)` is `true`, `max(true)` is `true`, `max(complex(1,2))` is
 * the Complex. The compat typed rest converts a boolean to a number first and
 * rejects a Complex, so the compat surface passes those through untouched.
 */
export function withRawSingleValue(
  fn: UnaryLike,
  extraPassthrough?: (x: unknown) => boolean
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    if (args.length === 1 && typeof args[0] === 'bigint') return args[0];
    if (args.length === 1 && (typeof args[0] === 'boolean' || extraPassthrough?.(args[0]))) {
      return args[0];
    }
    return apply(fn, args);
  });
}

/** mathjs rejects a non-numeric string before the typed conversion path runs. */
export function withInvalidNumericStringGuard(fn: UnaryLike): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    for (const arg of args) {
      if (typeof arg === 'string' && (arg.trim() === '' || Number.isNaN(Number(arg)))) {
        if (args.length > 1) {
          throw new Error(`Cannot convert "${arg}" to a number`);
        }
        throw invalidNumericStringError(arg);
      }
    }
    return apply(fn, args);
  });
}

/** `min` / `max` on Complex values throw mathjs's ordering error, not "Unexpected type". */
export function withComplexOrderingGuard(
  name: 'min' | 'max',
  fn: UnaryLike
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    if (args.some(isComplexLike) && args.length >= 2) {
      const sample = args.find(isComplexLike) as { re: number; im: number };
      throw new TypeError(
        `Cannot calculate ${name}, ${COMPLEX_ORDERING_ERROR} ` +
          `(type: Complex, value: ${JSON.stringify({
            mathjs: 'Complex',
            re: sample.re,
            im: sample.im,
          })})`
      );
    }
    return apply(fn, args);
  });
}

// =============================================================================
// #1550 — arg of a BigNumber
// =============================================================================

/**
 * `arg` of a real BigNumber is `0` (non-negative) or `pi` (negative), as a
 * BigNumber of the same precision. The compat `arg` factory builds a Complex
 * for the atan2 and crashes on a BigNumber.
 */
export function createCompatArg(
  native: UnaryLike,
  BigNumberClass: BigNumberCtor,
  getPrecision: () => number = () => 64,
  withPrecision: ArgPrecisionScope = (_p, build) => build(),
  getPi: () => unknown = () => Math.PI
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (args.length === 1 && (isBigNumberLike(args[0]) || isOwnBigNumber(args[0]))) {
      const bn = new BigNumberClass(args[0] as string);
      const negative = (bn as unknown as { isNegative(): boolean }).isNegative();
      const precision = getPrecision();
      return withPrecision(precision, () => {
        if (!negative) return new BigNumberClass(0);
        const piSource = getPi();
        const piText =
          typeof piSource === 'object' &&
          piSource !== null &&
          'toString' in (piSource as object) &&
          typeof (piSource as { toString(): string }).toString === 'function'
            ? (piSource as { toString(): string }).toString()
            : String(piSource);
        const pi = new BigNumberClass(piText);
        const rounded = (pi as unknown as { toPrecision(n: number): string }).toPrecision(
          precision
        );
        return new BigNumberClass(rounded);
      });
    }
    return apply(native, args);
  };
}

// =============================================================================
// #1550 / #1587 — variadic statistics dispatch
// =============================================================================

/**
 * mathjs's untyped `...any` rest signature accepts collections: the argument
 * list itself becomes the collection (`variance([1,2,3], [4,5,6])` is the
 * variance of all six values, `std(m1, m2)` the elementwise std through the
 * matrix multiply of the deviations). The compat typed rest rejects
 * collections, so the compat surface re-dispatches exactly like the mathjs
 * signature set: the `(A)`, `(A, normalization)`, `(A, dim)` and
 * `(A, dim, normalization)` forms go to the native signatures, every other
 * call passes the argument list as one collection.
 */
function flattenScalars(source: unknown, out: unknown[]): void {
  if (Array.isArray(source)) {
    for (const item of source) flattenScalars(item, out);
  } else {
    out.push(source);
  }
}

function reboxMatrixStatistics(
  args: unknown[],
  result: unknown,
  matrix: (data: unknown, storage?: string) => unknown
): unknown {
  if (!Array.isArray(result)) return result;
  const source = args
    .flat()
    .find((a) => typeof a === 'object' && a !== null && isMatrixLikeValue(a) && !Array.isArray(a));
  if (source === undefined) return result;
  const boxed = source as { storage?: () => string; isSparseMatrix?: boolean };
  const sparse = boxed.isSparseMatrix === true || boxed.storage?.() === 'sparse';
  return matrix(result, sparse ? 'sparse' : 'dense');
}

type StatisticsNormalization = 'unbiased' | 'uncorrected' | 'biased';

/**
 * The scalar operations the mathjs-shaped complex statistics path needs,
 * taken from the compat instance surface (the matrix factory re-boxes a
 * matrix result).
 */
export interface CompatStatisticsDeps {
  add: UnaryLike;
  subtract: UnaryLike;
  multiply: UnaryLike;
  divide: UnaryLike;
  sqrt: UnaryLike;
  matrix: (data: unknown, storage?: string) => unknown;
}

function mathjsComplexVariance(
  values: unknown[],
  normalization: StatisticsNormalization,
  ops: Pick<CompatStatisticsDeps, 'add' | 'subtract' | 'multiply' | 'divide'>
): unknown {
  const { add, subtract, multiply, divide } = ops;
  const n = values.length;
  let sum = values[0];
  for (let i = 1; i < n; i++) sum = apply(add, [sum, values[i]]);
  const mean = apply(divide, [sum, n]);
  let sqSum: unknown;
  for (const v of values) {
    const diff = apply(subtract, [v, mean]);
    const sq = apply(multiply, [diff, diff]);
    sqSum = sqSum === undefined ? sq : apply(add, [sqSum, sq]);
  }
  switch (normalization) {
    case 'uncorrected':
      return apply(divide, [sqSum, n]);
    case 'biased':
      return apply(divide, [sqSum, n + 1]);
    default:
      // A single value has no deviation: mathjs returns its numeric zero (a
      // BigNumber zero for BigNumber data, the number 0 otherwise — also for a
      // lone Complex, whose squared deviation is the complex zero).
      if (n === 1) {
        if (isBigNumberLike(sqSum) || isOwnBigNumber(sqSum)) {
          return apply(multiply, [sqSum, 0]);
        }
        return 0;
      }
      return apply(divide, [sqSum, n - 1]);
  }
}

/**
 * Variadic mathjs statistics (`variance` / `std`): untyped collections, empty-input
 * errors, matrix re-boxing, and complex data through the mathjs `diff * diff` path
 * (native critical libraries keep NumPy-style `re(diff * conj(diff))`).
 */
export function createCompatMathjsStatistics(
  name: 'variance' | 'std',
  native: UnaryLike,
  deps: CompatStatisticsDeps
): (...args: unknown[]) => unknown {
  const isDim = (x: unknown): boolean =>
    typeof x === 'number' || isBigNumberLike(x) || isOwnBigNumber(x);
  const isNorm = (x: unknown): x is StatisticsNormalization =>
    x === 'unbiased' || x === 'uncorrected' || x === 'biased';

  /** The mathjs complex path (`diff * diff`, no conjugation), sqrt for std. */
  const complexVariance = (values: unknown[], normalization: StatisticsNormalization): unknown => {
    const variance = mathjsComplexVariance(values, normalization, deps);
    return name === 'std' ? apply(deps.sqrt, [variance]) : variance;
  };

  return keepSurface(native, (...args: unknown[]): unknown => {
    // mathjs rejects the empty forms before any dispatch: no argument is the
    // typed-function rest error, an empty Array is the statistics SyntaxError.
    if (args.length === 0) {
      throw new TypeError(`Too few arguments in function ${name} (expected: any, index: 0)`);
    }
    for (const arg of args) {
      if (
        typeof arg === 'string' &&
        !isNorm(arg) &&
        (arg.trim() === '' || Number.isNaN(Number(arg)))
      ) {
        if (args.length === 1 && !Array.isArray(arg)) {
          throw invalidNumericStringError(arg);
        }
        throw new Error(`Cannot convert "${arg}" to a number`);
      }
    }
    if (args.length === 1 && Array.isArray(args[0]) && args[0].length === 0) {
      throw statisticsEmptyParametersError(name);
    }
    if (args.length > 0 && isMatrixLikeValue(args[0])) {
      // The signature forms: (A), (A, normalization), (A, dim) and
      // (A, dim, normalization). A normalization string that mathjs would
      // reject keeps the native rejection.
      if (args.length === 2 && typeof args[1] === 'string') {
        if (!isNorm(args[1])) return apply(native, args);
        const flat: unknown[] = [];
        flattenScalars(args[0], flat);
        if (flat.some(isComplexLike)) return complexVariance(flat, args[1]);
        return reboxMatrixStatistics(args, apply(native, args), deps.matrix);
      }
      if (args.length === 3 && isDim(args[1]) && typeof args[2] === 'string') {
        if (!isNorm(args[2])) return apply(native, args);
        return reboxMatrixStatistics(args, apply(native, args), deps.matrix);
      }
      if (args.length === 1) {
        const flat: unknown[] = [];
        flattenScalars(args[0], flat);
        if (flat.some(isComplexLike)) return complexVariance(flat, 'unbiased');
        return reboxMatrixStatistics(args, apply(native, args), deps.matrix);
      }
      if (args.length === 2 && isDim(args[1])) {
        return reboxMatrixStatistics(args, apply(native, args), deps.matrix);
      }
      // The untyped rest with collections: the argument list itself is the
      // collection (mathjs flattens plain arrays and keeps matrix elements
      // whole, which drives the whole computation).
      const flat: unknown[] = [];
      flattenScalars(args, flat);
      if (
        flat.some(isComplexLike) &&
        !flat.some((v) => isMatrixLikeValue(v) && !Array.isArray(v))
      ) {
        return complexVariance(flat, 'unbiased');
      }
      return reboxMatrixStatistics(args, apply(native, [args]), deps.matrix);
    }
    // Scalar variadic: mathjs treats every argument as one value of the list.
    if (args.some(isComplexLike)) {
      return complexVariance(args, 'unbiased');
    }
    return reboxMatrixStatistics(args, apply(native, args), deps.matrix);
  });
}

/** Untyped variadic dispatch only (unit tests); production uses {@link createCompatMathjsStatistics}. */
export function createCompatVarargsStatistics(native: UnaryLike): (...args: unknown[]) => unknown {
  const isDim = (x: unknown): boolean =>
    typeof x === 'number' || isBigNumberLike(x) || isOwnBigNumber(x);
  return keepSurface(native, (...args: unknown[]): unknown => {
    if (args.length > 0 && isMatrixLikeValue(args[0])) {
      if (args.length === 1) return apply(native, args);
      if (args.length === 2 && typeof args[1] === 'string') return apply(native, args);
      if (args.length === 2 && isDim(args[1])) return apply(native, args);
      if (args.length === 3 && isDim(args[1]) && typeof args[2] === 'string') {
        return apply(native, args);
      }
      return apply(native, [args]);
    }
    if (
      args.length > 1 &&
      !(args.length === 2 && (typeof args[1] === 'string' || isDim(args[1])))
    ) {
      return apply(native, [args]);
    }
    return apply(native, args);
  });
}

/** Wrap a function so every argument (and Array element) is converted first. */
export function withConvertedScalars(
  convert: (v: unknown) => unknown,
  fn: UnaryLike
): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    const converted = args.map(convert);
    const promoted = promoteBooleanScalarsForBigNumber(converted, CompatBigNumber);
    return compatDecimalResult(apply(fn, promoted));
  });
}

// =============================================================================
// #1588 — expm always returns a Matrix
// =============================================================================

/**
 * mathjs `expm` returns a DenseMatrix even for Array input. The native
 * `matrixExpm` returns the input kind, so the compat surface wraps an Array
 * result.
 */
export function createCompatExpm(
  native: UnaryLike,
  matrix: (data: unknown) => unknown
): (...args: unknown[]) => unknown {
  return (x?: unknown): unknown => {
    const result = apply(native, [x]);
    return Array.isArray(result) && Array.isArray(x) ? matrix(result) : result;
  };
}

// =============================================================================
// #1550 — foreign oracle scalars reach compat arithmetic
// =============================================================================

/** The classes the converter builds compat instances with. */
export interface ForeignScalarClasses {
  FractionClass: new (n: bigint, d: bigint) => CompatFractionType;
  BigNumberClass: BigNumberCtor;
  ComplexClass: new (re: number, im: number) => unknown;
  /** Build a compat (bridge) DenseMatrix from nested data. */
  denseFrom: (nested: unknown) => unknown;
  /** Build a compat (bridge) SparseMatrix from nested data. */
  sparseFrom: (nested: unknown) => unknown;
  /** Recognize a compat bridge matrix (its prototype comes from the functions factories). */
  isOwnMatrix: (x: unknown) => boolean;
}

/**
 * The differential harness passes oracle (mathjs-package) values into compat.
 * The compat typed functions brand-check their scalars, so a foreign decimal,
 * fraction or complex is rejected where mathjs accepts its own. Convert the
 * foreign scalars (and the scalars of an Array argument) to compat instances
 * at the compat boundary.
 */
export function createForeignScalarConverter(
  classes: ForeignScalarClasses
): (v: unknown) => unknown {
  const convert = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(convert);
    if (typeof v !== 'object' || v === null) return v;
    if (!isOwnBigNumber(v) && isBigNumberLike(v)) {
      return new classes.BigNumberClass((v as { toString(): string }).toString());
    }
    if (!isFraction(v) && isFractionLike(v)) return toCompatFraction(v, classes.FractionClass);
    const c = v as { isComplex?: boolean; re?: unknown; im?: unknown };
    if (
      c.isComplex === true &&
      !isComplex(v) &&
      typeof c.re === 'number' &&
      typeof c.im === 'number'
    ) {
      return new classes.ComplexClass(c.re, c.im);
    }
    // A foreign mathjs matrix becomes the compat bridge matrix of the same kind,
    // so the compat typed functions accept it. Number-valued matrices only: the
    // round trip through `toArray` keeps the values, not the datatype string.
    if (isMatrixLikeValue(v) && !classes.isOwnMatrix(v)) {
      const m = v as { isSparseMatrix?: boolean; toArray(): unknown };
      const nested = m.toArray();
      return m.isSparseMatrix === true ? classes.sparseFrom(nested) : classes.denseFrom(nested);
    }
    return v;
  };
  return convert;
}

// =============================================================================
// #1583 — mad with the mathjs flatten and median behavior
// =============================================================================

/** Dependencies of the compat `mad`, taken from the compat instance surface. */
export interface MadDependencies {
  subtract: UnaryLike;
  abs: UnaryLike;
  add: UnaryLike;
  divide: UnaryLike;
  compare: UnaryLike;
  unaryPlus: UnaryLike;
  /** The shared foreign-scalar converter (oracle values in, compat values out). */
  convert: (v: unknown) => unknown;
}

/**
 * mathjs `mad` (#1583):
 *
 * - `flatten` keeps every non-array element whole — a Matrix argument of the
 *   variadic form survives as one "value", which drives the whole rest of the
 *   computation (the median of `[matrix, x]` is the matrix itself, so the
 *   deviations of the matrix elements are 0).
 * - the even median averages the two middle values through `partitionSelect`,
 *   whose raw-compare quickselect (and the elementwise `isNumeric`/`isNaN`
 *   accident on matrices) decides which operand stays the left one — the unit
 *   of the result follows it.
 * - a mixed bigint/number list computes in numbers (mathjs converts
 *   bigint→number, its lowest-index bigint conversion), so `mad(2n, 0)` is the
 *   number 1, not a Fraction.
 */
export function createCompatMad(deps: MadDependencies): (...args: unknown[]) => unknown {
  const { subtract, abs, add, divide, compare, unaryPlus, convert } = deps;
  const compareFn = compare as unknown as (a: unknown, b: unknown) => number;

  /** Flatten plain arrays only; every other element stays whole (mathjs `flatten`). */
  function flatten(source: unknown, out: unknown[]): void {
    if (Array.isArray(source)) {
      for (const item of source) flatten(item, out);
    } else {
      out.push(source);
    }
  }

  /**
   * A string becomes its number (mathjs converts through the typed
   * conversions; a non-numeric string throws the mathjs conversion Error);
   * everything else goes through the shared foreign-scalar converter.
   */
  function toCompatValue(v: unknown, single: boolean): unknown {
    if (typeof v === 'string') {
      const n = Number(v);
      if (v.trim() !== '' && !Number.isNaN(n)) return n;
      // mathjs converts a string through the value's own path: a lone string
      // goes through unaryPlus (SyntaxError), a string among several goes
      // through compare/add (the conversion Error).
      if (single) throw invalidNumericStringError(v);
      throw new Error(`Cannot convert "${v}" to a number`);
    }
    return convert(v);
  }

  function assertNoComplexOrdering(values: unknown[]): void {
    if (values.some(isComplexLike) && values.length >= 2) {
      throw new TypeError(`Cannot calculate mad, ${COMPLEX_ORDERING_ERROR}`);
    }
  }

  /**
   * mathjs converts a bigint to a number (its lowest-index bigint conversion)
   * whenever the operand pair is mixed, so a mixed list computes in numbers.
   */
  function normalizeNumbers(flat: unknown[]): unknown[] {
    const hasBigint = flat.some((v) => typeof v === 'bigint');
    if (!hasBigint) return flat;
    // A matrix element is one "value" of the list (it stays whole below), so a
    // bigint next to a matrix keeps its bigint type; every other non-bigint
    // scalar (number, Unit, Complex, …) pulls the list into numbers, mathjs's
    // lowest-index bigint conversion.
    const hasOther = flat.some(
      (v) => typeof v !== 'bigint' && v !== null && (typeof v !== 'object' || !isMatrixLikeValue(v))
    );
    if (!hasOther) return flat;
    return flat.map((v) => (typeof v === 'bigint' ? Number(v) : v));
  }

  /**
   * mathjs `partitionSelect`: the quickselect of mathjs 15.3.0, including the
   * accident that a Matrix element passes the elementwise `isNumeric`/`isNaN`
   * pre-check (both come back as truthy matrices) and is returned untouched,
   * and the real-NaN early return.
   */
  function partitionSelect(arr: unknown[], k: number): unknown {
    if (!Number.isInteger(k) || k < 0) throw new Error('k must be a non-negative integer');
    for (const x of arr) {
      if (isMatrixLikeValue(x)) return x;
    }
    for (const x of arr) {
      if (typeof x === 'number' && Number.isNaN(x)) return x;
    }
    let from = 0;
    let to = arr.length - 1;
    while (from < to) {
      let r = from;
      let w = to;
      const pivot = arr[Math.floor(Math.random() * (to - from + 1)) + from] as unknown;
      while (r < w) {
        if (compareFn(arr[r], pivot) >= 0) {
          const tmp = arr[w];
          arr[w] = arr[r];
          arr[r] = tmp;
          --w;
        } else {
          ++r;
        }
      }
      if (compareFn(arr[r], pivot) > 0) --r;
      if (k <= r) to = r;
      else from = r + 1;
    }
    return arr[k];
  }

  /** mathjs `_median` over a flat list. */
  function medianShape(list: unknown[]): unknown {
    const num = list.length;
    if (num === 0) throw new Error('Cannot calculate median of an empty array');
    if (num % 2 === 0) {
      const mid = num / 2 - 1;
      const right = partitionSelect(list, mid + 1);
      let left = list[mid];
      for (let i = 0; i < mid; ++i) {
        if (compareFn(list[i], left) > 0) left = list[i];
      }
      const sum = apply(add, [left, right]);
      return apply(divide, [sum, typeof sum === 'bigint' ? 2n : 2]);
    }
    return apply(unaryPlus, [partitionSelect(list, (num - 1) / 2)]);
  }

  return (...args: unknown[]): unknown => {
    if (args.length === 0) throw tooFewArgumentsError('mad', 0);
    if (
      args.length === 1 &&
      typeof args[0] === 'string' &&
      (args[0].trim() === '' || Number.isNaN(Number(args[0])))
    ) {
      throw invalidNumericStringError(args[0]);
    }
    const source = args.length === 1 ? args[0] : args;
    const flat: unknown[] = [];
    if (isMatrixLikeValue(source) && !Array.isArray(source)) {
      flatten((source as { toArray(): unknown[] }).toArray(), flat);
    } else if (Array.isArray(source)) {
      flatten(source, flat);
    } else {
      flat.push(source);
    }
    if (flat.length === 0) {
      throw new Error('Cannot calculate median absolute deviation (mad) of an empty array');
    }
    const values = normalizeNumbers(flat.map((v) => toCompatValue(v, flat.length === 1)));
    assertNoComplexOrdering(values);
    try {
      const med = medianShape([...values]);
      return medianShape(values.map((value) => apply(abs, [apply(subtract, [value, med])])));
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('median')) {
        throw new TypeError(err.message.replace('median', 'mad'), { cause: err });
      }
      throw err;
    }
  };
}

// =============================================================================
// #1550 — identity validates positive-integer sizes, round rejects negative
// =============================================================================

/**
 * mathjs `identity` requires positive-integer sizes (`identity(0)` throws);
 * the compat factory follows the native zeros/ones validation and allows 0, so
 * the compat surface applies the mathjs validation here.
 */
export function withIdentityValidation(fn: UnaryLike): (...args: unknown[]) => unknown {
  const isNum = (x: unknown): boolean =>
    typeof x === 'number' ||
    typeof x === 'boolean' ||
    typeof x === 'bigint' ||
    isBigNumberLike(x) ||
    isOwnBigNumber(x) ||
    (typeof x === 'string' && x.trim() !== '' && !Number.isNaN(Number(x)));
  const isStr = (x: unknown): boolean => typeof x === 'string';
  const isArr = Array.isArray;
  const isMat = (x: unknown): boolean => isMatrixLikeValue(x) && !Array.isArray(x);
  /** The size value of a matched signature, as mathjs converts it. */
  const sizeValue = (v: unknown): number => {
    if (typeof v === 'boolean' || typeof v === 'bigint' || typeof v === 'string') return Number(v);
    if (isBigNumberLike(v) || isOwnBigNumber(v)) {
      return Number((v as { toNumber(): number }).toNumber());
    }
    return v as number;
  };
  const check = (v: unknown): boolean => {
    const n = sizeValue(v);
    return Number.isInteger(n) && n > 0;
  };
  return (...args: unknown[]): unknown => {
    // Only the size-taking signature shapes validate; every other shape keeps
    // the native typed rejection, which is the mathjs one.
    const matchesShape =
      args.length === 0 ||
      (args.length === 1 &&
        (isNum(args[0]) || isStr(args[0]) || isArr(args[0]) || isMat(args[0]))) ||
      (args.length === 2 && isNum(args[0]) && (isStr(args[1]) || isNum(args[1]))) ||
      (args.length === 2 && (isArr(args[0]) || isMat(args[0])) && isStr(args[1])) ||
      (args.length === 3 && isNum(args[0]) && isNum(args[1]) && isStr(args[2]));
    if (
      !matchesShape &&
      args.length === 3 &&
      isNum(args[0]) &&
      isNum(args[1]) &&
      typeof args[2] !== 'string'
    ) {
      // mathjs reports the third parameter against its 'string or boolean'
      // union before the arity problem surfaces.
      throw new TypeError(
        `Unexpected type of argument in function identity (expected: string or boolean, ` +
          `actual: ${typeof args[2] === 'number' ? 'number' : typeof args[2]}, index: 2)`
      );
    }
    if (matchesShape) {
      const sizes: unknown[] = [];
      if (args.length > 0 && isArr(args[0])) {
        sizes.push(...args[0]);
      } else if (args.length > 0 && isNum(args[0])) {
        sizes.push(args[0]);
        if (args.length >= 2 && isNum(args[1])) sizes.push(args[1]);
      }
      if (sizes.some((x) => !check(x))) {
        throw new Error('Parameters in function identity must be positive integers');
      }
    }
    return apply(fn, args);
  };
}

/**
 * mathjs `round` rejects a negative digit count for BigNumber (decimal.js
 * raises `[DecimalError] Invalid argument`) and for Fraction (fraction.js
 * raises its `must be positive` RangeError); the number path validates 0–15 in
 * the native factory already. The compat typed round implements negative
 * counts as an extension, so the compat surface rejects them like mathjs.
 */
export function withRoundDigitsGuard(fn: UnaryLike): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (
      args.length === 2 &&
      typeof args[1] === 'number' &&
      Number.isInteger(args[1]) &&
      args[1] < 0
    ) {
      if (isFractionLike(args[0])) throw new RangeError('undefined must be positive');
      if (isBigNumberLike(args[0]) || isOwnBigNumber(args[0])) {
        throw new Error(`[DecimalError] Invalid argument: ${args[1]}`);
      }
    }
    return apply(fn, args);
  };
}

// =============================================================================
// #1587 — erf under the BigNumber config
// =============================================================================

/**
 * mathjs `evaluate('erf(0.2)')` under the `number: 'BigNumber'` config throws:
 * the expression scope's erf has no BigNumber signature. The direct instance
 * call keeps its native extension, so the guard binds only in the expression
 * scope, with the mathjs message (the oracle's typed function is literally
 * named `name`).
 */
const ERF_BIGNUMBER_ERROR =
  'Unexpected type of argument in function name ' +
  '(expected: number or Array or Matrix or bigint or string or boolean, ' +
  'actual: BigNumber, index: 0)';

const ERF_FRACTION_ERROR =
  'Unexpected type of argument in function name ' +
  '(expected: number or Array or Matrix or bigint or string or boolean, ' +
  'actual: Fraction, index: 0)';

/** mathjs scope and instance `erf` reject BigNumber and Fraction (#1587). */
export function createCompatErfExpression(native: UnaryLike): (...args: unknown[]) => unknown {
  return keepSurface(native, (...args: unknown[]): unknown => {
    if (args.length >= 1 && isFractionLike(args[0])) {
      throw new TypeError(ERF_FRACTION_ERROR);
    }
    if (args.length >= 1 && (isBigNumberLike(args[0]) || isOwnBigNumber(args[0]))) {
      throw new TypeError(ERF_BIGNUMBER_ERROR);
    }
    return apply(native, args);
  });
}

/** mathjs instance `gamma` on a non-integer BigNumber (#1587). */
export function createCompatGammaBigNumberGuard(
  native: UnaryLike,
  convert: (v: unknown) => unknown
): (...args: unknown[]) => unknown {
  return keepSurface(native, (...args: unknown[]): unknown => {
    if (args.length >= 1 && (isOwnBigNumber(args[0]) || isBigNumberLike(args[0]))) {
      // mathjs `gamma` of a BigNumber requires an integer ("Integer BigNumber
      // expected", its decimal configuration); a foreign decimal converts to
      // the compat class first, so the native call accepts it.
      const bn = convert(args[0]) as CompatBigNumberType;
      if (bn.isFinite() && !bn.isInteger()) throw new Error('Integer BigNumber expected');
      return apply(native, [bn]);
    }
    return apply(native, args);
  });
}

/**
 * mathjs converts a lone string argument of `sum` at the end of the reduction
 * (`numeric(sum, config)`), which raises its SyntaxError; the compat typed
 * surface converts earlier and raises its own Error. Only the single-argument
 * form takes this path — a string among several goes through compare/add and
 * keeps the conversion Error.
 */
export function withSingleNumericStringGuard(fn: UnaryLike): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    if (
      args.length === 1 &&
      typeof args[0] === 'string' &&
      (args[0].trim() === '' || Number.isNaN(Number(args[0])))
    ) {
      throw invalidNumericStringError(args[0]);
    }
    return apply(fn, args);
  });
}
