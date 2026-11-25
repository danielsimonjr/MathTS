import { BigNumber as CompatBigNumber, compatDecimalResult } from './bignumber.js';
/**
 * mathjs Compatibility Shims
 *
 * Provides mathjs-compatible API wrappers around MathTS functions.
 * This allows gradual migration from mathjs to MathTS.
 *
 * @packageDocumentation
 */

import {
  Complex,
  Fraction,
  BigNumber,
  I,
  COMPLEX_ZERO,
  isComplex,
  isFraction,
  mathTyped,
  isBigNumber,
  isNumber,
  LN2 as CORE_LN2,
  LN10 as CORE_LN10,
  LOG2E as CORE_LOG2E,
  LOG10E as CORE_LOG10E,
  SQRT2 as CORE_SQRT2,
  SQRT1_2 as CORE_SQRT1_2,
} from '@danielsimonjr/mathts-core';
import type { TypedFunction } from '@danielsimonjr/mathts-core';
import type {
  BridgeMatrix,
  PublicAbs,
  PublicAdd,
  PublicCos,
  PublicExp,
  PublicLog,
  PublicMean,
  PublicSin,
  PublicSqrt,
  PublicStd,
  PublicTan,
  PublicVariance,
} from '@danielsimonjr/mathts-functions';

import {
  add as _add,
  addScalar as _addScalar,
  subtract as _subtract,
  multiply as _multiply,
  multiplyScalar as _multiplyScalar,
  number as _number,
  divide as _divide,
  factory_divide as _factoryDivide,
  inv as _inv,
  factory_pow as _factoryPow,
  abs as _abs,
  factory_exp as _exp,
  factory_log as _log,
  factory_sin as _sin,
  factory_cos as _cos,
  factory_tan as _tan,
  factory_asin as _asin,
  factory_acos as _acos,
  factory_atan as _atan,
  atan2 as _atan2,
  sum as _sum,
  mean as _mean,
  std as _std,
  variance as _variance,
  min as _min,
  max as _max,
  gcd as _gcd,
  lcm as _lcm,
  round as _round,
  floor as _floor,
  ceil as _ceil,
  matrix as _factoryMatrix,
  sparse as _factorySparse,
  zeros as _factoryZeros,
  ones as _factoryOnes,
  factory_transpose as _transpose,
  det as _det,
  size as _size,
  factory_mathjsCompat,
  complex as _complex,
  format as _format,
  config,
  isPositive as _isPositive,
  isNegative as _isNegative,
  isInteger as _isInteger,
  fix as _fix,
} from '@danielsimonjr/mathts-functions';
import { mathjsPowFractionPair } from './mathjs-fraction-pow.js';
import { UNARY_NUMBER_FAST_PATH, type UnaryNumberFastPath } from './unary-fast-path.js';
import {
  DenseMatrix,
  SparseMatrix,
  isDenseMatrix,
  isSparseMatrix,
  add as _matAdd,
  subtract as _matSubtract,
  multiply as _matMultiply,
} from '@danielsimonjr/mathts-matrix';
import { isEmpty2DSize, matrixSize, notSquareError } from '@danielsimonjr/mathts-core/internal';

// =============================================================================
// Type Creation Shims (mathjs-style factory functions)
// =============================================================================

/**
 * Create a complex number (mathjs-compatible)
 * @example
 * complex(3, 4)  // Complex(3, 4)
 * complex(5)     // Complex(5, 0)
 * complex('3+4i') // Complex(3, 4)
 *
 * No argument gives COMPLEX_ZERO and a Complex is returned unchanged. Every other input goes to
 * the functions `complex`: a BigNumber, Fraction, bigint, boolean, {re, im}, {r, phi}, Array or
 * Matrix converts, and an invalid part or a third argument throws a TypeError, as in mathjs.
 * The call shape `(value, index, collection)` converts the value, so `[1, 2].map(complex)` works.
 */
export function complex(re?: number | string | Complex, im?: number, ...rest: unknown[]): Complex {
  if (re === undefined && im === undefined && rest.length === 0) {
    return COMPLEX_ZERO;
  }
  // The brand tests also return a value of a second copy of core unchanged (#1033).
  if (isComplex(re) && im === undefined && rest.length === 0) {
    return re as Complex;
  }
  // Every other input uses the functions `complex`, which follows mathjs (#1220).
  const args = im === undefined && rest.length === 0 ? [re] : [re, im, ...rest];
  return (_complex as (...a: unknown[]) => Complex)(...args);
}

/** The call forms of the compat {@link fraction}. */
interface CompatFraction {
  (numerator?: number | string | Fraction, denominator?: number): Fraction;
}

/**
 * Create a fraction (mathjs-compatible)
 * @example
 * fraction(1, 2)   // Fraction(1, 2)
 * fraction('1/2')  // Fraction(1, 2)
 * fraction(0.5)    // Fraction(1, 2)
 * fraction()       // Fraction(0, 1)
 *
 * The function is the compatibility fraction factory with two more signatures: no argument and
 * `undefined` give 0, as the compat `fraction` always did. The functions `fraction` is a
 * typed-function, so `map(x, fraction)`, `matrix.map(fraction)` and `evaluate` pass the value
 * alone and not the index as the denominator (#1160). A Fraction of a second copy of core is
 * returned unchanged (#1033), and a BigNumber, a bigint, null, an object `{ n, d }`, a Unit, an
 * Array and a Matrix convert, as in mathjs.
 */
export const fraction = mathTyped('fraction', factory_mathjsCompat.fraction as never, {
  '': () => new Fraction(0, 1),
  undefined: () => new Fraction(0, 1),
}) as unknown as CompatFraction;

const compatBignumber = factory_mathjsCompat.compatFactoryExports().createBignumber({
  typed: factory_mathjsCompat.createCompatTyped(),
  BigNumber: CompatBigNumber,
});

/**
 * Create a BigNumber (mathjs-compatible). An Array or a Matrix converts element by element,
 * a Unit converts its value, and no value gives 0.
 * @example
 * bignumber('123.456')
 * bignumber(123)
 * bignumber([1, 2]) // [BigNumber 1, BigNumber 2]
 */
export function bignumber(
  value: readonly unknown[] | CompatMatrixValue | { readonly isUnit: boolean }
): unknown;
export function bignumber(
  value?: number | string | bigint | boolean | null | BigNumber | Fraction
): BigNumber;
export function bignumber(value?: unknown): unknown {
  if (value === undefined) {
    return new CompatBigNumber(0);
  }
  return compatBignumber(value);
}

/** Matrix values returned from the compat `matrix` shim (native, or the bridge matrix of `functions`). */
export type CompatMatrixValue = DenseMatrix | SparseMatrix | BridgeMatrix;

/** mathjs bridge matrix from `functions` factories (`prototype.isMatrix === true`). */
function isCompatBridgeMatrix(x: unknown): boolean {
  if (isDenseMatrix(x) || isSparseMatrix(x)) {
    return true;
  }
  if (typeof x === 'object' && x !== null) {
    const proto = Object.getPrototypeOf(x) as { isMatrix?: boolean } | null;
    return proto?.isMatrix === true;
  }
  return false;
}

function isBoxedMatrix(x: unknown): boolean {
  return isCompatBridgeMatrix(x) && !isDenseMatrix(x) && !isSparseMatrix(x);
}

/**
 * A native `DenseMatrix` of the nested data `arr`. `DenseMatrix.fromArray` holds no empty axis,
 * and the nested data of a matrix with a zero axis does not show its size (`[]` is 0 x 3 as well
 * as 0 x 0). So the size of the operand `m` decides the empty case.
 */
function denseOfNested(arr: unknown[], m: unknown): DenseMatrix {
  const size = axesOf(m);
  if (size !== null && isEmpty2DSize(size)) {
    return DenseMatrix.zeros(size[0], size[1]);
  }
  return DenseMatrix.fromArray(arr as number[][]);
}

/** Normalize compat/matrix inputs to a native `DenseMatrix` for linear algebra shims. */
function compatToDenseMatrix(m: unknown): DenseMatrix {
  if (isDenseMatrix(m)) {
    return m;
  }
  if (isSparseMatrix(m)) {
    return denseOfNested(m.toArray(), m);
  }
  if (Array.isArray(m)) {
    return DenseMatrix.fromArray(m as number[][]);
  }
  if (typeof m === 'object' && m !== null && 'toArray' in m) {
    const arr = (m as { toArray(): unknown }).toArray();
    if (Array.isArray(arr)) {
      return denseOfNested(arr, m);
    }
  }
  throw new TypeError('Expected DenseMatrix or 2D array');
}

/**
 * Create a matrix (mathjs-compatible)
 * @example
 * matrix([[1,2],[3,4]])
 * matrix([1,2])            // a 1-D matrix of size [2]
 * matrix([[1,2],[3,4]], 'sparse')
 * matrix(sparseMatrix, 'dense')
 */
export function matrix(data?: readonly unknown[], format?: string): BridgeMatrix;
export function matrix(
  data?: readonly unknown[] | DenseMatrix | SparseMatrix,
  format?: string
): CompatMatrixValue;
export function matrix(
  data?: readonly unknown[] | DenseMatrix | SparseMatrix,
  format?: string
): CompatMatrixValue {
  if (arguments.length === 0) {
    return _factoryMatrix();
  }
  if (isDenseMatrix(data) || isSparseMatrix(data)) {
    // A native matrix of the format that is asked for, or of no format, is returned as it is.
    if (format === undefined) return data;
    // The factory checks the format, so an unknown one throws the mathjs TypeError here too.
    _factoryMatrix([], format);
    // The nested data of a matrix with a zero axis does not show its size, so the size of the
    // source goes with the data (#1337).
    if (format === 'sparse' && isDenseMatrix(data)) {
      return _factorySparse({
        data: data.toArray(),
        size: matrixSize(data),
      });
    }
    if (format !== 'sparse' && isSparseMatrix(data)) {
      return denseOfNested(data.toArray(), data);
    }
    return data;
  }
  // An explicit undefined data argument reaches the factory, which throws the mathjs TypeError.
  return _factoryMatrix(data, format);
}

/**
 * Create a sparse matrix (mathjs-compatible)
 */
export function sparse(data?: number[][]): BridgeMatrix {
  if (data === undefined) {
    return _factorySparse();
  }
  return _factorySparse(data);
}

// =============================================================================
// Arithmetic Function Shims
// =============================================================================

// add/subtract/multiply send a pair that the matrix package can take (a scalar with a 2-D
// operand, or two 2-D operands; see `matrixPackageCanTake`) to the matrix package. Every other
// pair goes to the typed function of the functions package, which has the vector and broadcast
// rules of mathjs.
type MatrixLike = number[][] | DenseMatrix | CompatMatrixValue;

const isMatrixLike = (x: unknown): x is MatrixLike =>
  isCompatBridgeMatrix(x) ||
  (Array.isArray(x) && x.length > 0 && Array.isArray((x as unknown[])[0]));

const toDenseMatrix = (x: MatrixLike): DenseMatrix => compatToDenseMatrix(x);

/**
 * An arithmetic result as the nested Array of its entries. A matrix with a zero axis stays a
 * matrix: its nested Array `[]` does not show the size, and reads as 0 x 0.
 */
const unwrap = (r: unknown): unknown => {
  if (!isCompatBridgeMatrix(r)) return r;
  const size = axesOf(r);
  if (isEmpty2DSize(size)) return r;
  return (r as { toArray(): unknown }).toArray();
};

/** The axis lengths of an Array or a matrix operand, read along the first elements; null for a scalar. */
const axesOf = (x: unknown): number[] | null => {
  if (isCompatBridgeMatrix(x)) return matrixSize(x) ?? null;
  if (!Array.isArray(x)) return null;
  const axes: number[] = [];
  for (let level: unknown = x; Array.isArray(level); level = level[0]) axes.push(level.length);
  return axes;
};

/**
 * True when the matrix package can take the pair: a scalar with a 2-D operand, or two 2-D
 * operands. An element-wise operation also needs equal sizes. Every other pair (a 1-D operand, a
 * size-1 axis, another rank) needs the broadcast and vector rules of the typed function (#1007, #1302).
 */
const matrixPackageCanTake = (a: unknown, b: unknown, elementwise: boolean): boolean => {
  const sa = axesOf(a);
  const sb = axesOf(b);
  if (sa !== null && sa.length !== 2) return false;
  if (sb !== null && sb.length !== 2) return false;
  return !(elementwise && sa !== null && sb !== null && (sa[0] !== sb[0] || sa[1] !== sb[1]));
};

const applyArithmetic = (
  scalarFn: (a: unknown, b: unknown) => unknown,
  matrixFn: (a: unknown, b: unknown) => unknown,
  a: unknown,
  b: unknown,
  elementwise: boolean
): unknown => {
  // Boxed operands carry the storage format and may hold non-double scalar types.
  // Keep them in the typed path rather than coercing them to the numeric backend.
  if (isBoxedMatrix(a) || isBoxedMatrix(b)) {
    const boxedA = Array.isArray(a) ? _factoryMatrix(a) : a;
    const boxedB = Array.isArray(b) ? _factoryMatrix(b) : b;
    return scalarFn(boxedA, boxedB);
  }
  if (isMatrixLike(a) || isMatrixLike(b)) {
    if (!matrixPackageCanTake(a, b, elementwise)) return unwrap(scalarFn(a, b));
    const aa = isMatrixLike(a) ? toDenseMatrix(a) : a;
    const bb = isMatrixLike(b) ? toDenseMatrix(b) : b;
    return unwrap(matrixFn(aa, bb));
  }
  return compatDecimalResult(scalarFn(a, b));
};

// mathjs `add`/`subtract`/`multiply` are variadic and left-fold over all
// arguments: add(x, y, z, …) === add(add(x, y), z), …. A 2-arg-only wrapper
// silently dropped the 3rd+ operand (add(1,2,3) returned 3), which also broke
// internal callers like polynomialRoot's cubic branch. Fold over every arg.
const makeArithmetic =
  (
    scalarFn: (a: unknown, b: unknown) => unknown,
    matrixFn: (a: unknown, b: unknown) => unknown,
    elementwise: boolean,
    fastNumberPair?: (a: number, b: number) => number
  ) =>
  (...args: unknown[]): unknown => {
    if (args.length === 0) {
      throw new TypeError('Too few arguments (expected at least 1)');
    }
    if (args.length === 1) {
      return args[0];
    }
    if (
      args.length === 2 &&
      fastNumberPair &&
      typeof args[0] === 'number' &&
      typeof args[1] === 'number'
    ) {
      return fastNumberPair(args[0], args[1]);
    }
    return args.reduce((acc, next) => applyArithmetic(scalarFn, matrixFn, acc, next, elementwise));
  };

/**
 * One-argument shim with the same number fast path as `add` (#735, #889). A number
 * argument inside `inReal` takes `fastNumber` directly. Every other input (Complex,
 * BigNumber, matrices, out-of-domain reals that return Complex) goes to the typed function.
 */
const makeUnaryFastPath = (scalarFn: (...args: unknown[]) => unknown, fp: UnaryNumberFastPath) => {
  const fast = function (x?: unknown): unknown {
    if (arguments.length === 1 && typeof x === 'number' && fp.inReal(x)) {
      return fp.fastNumber(x);
    }
    return scalarFn.apply(undefined, arguments as unknown as unknown[]);
  };
  return withTypedSurface(fast, scalarFn);
};

/**
 * Gives a shim the surface of the typed function that it wraps (name, length, signatures, ...).
 *
 * @param shim - The shim function.
 * @param typedFn - The typed function.
 * @returns The shim.
 */
function withTypedSurface<T extends object>(shim: T, typedFn: object): T {
  for (const key of Reflect.ownKeys(typedFn)) {
    if (key === 'prototype') continue;
    const desc = Object.getOwnPropertyDescriptor(typedFn, key);
    if (desc) Object.defineProperty(shim, key, desc);
  }
  return shim;
}

type OneArg = <T>(value: T) => T;
type BinaryArithmetic = (left: unknown, right: unknown) => unknown;
type NumericStringArithmetic = (
  left: string | number,
  right: string | number,
  ...rest: (string | number)[]
) => number;

function withNumericText(arithmetic: BinaryArithmetic, scalar: BinaryArithmetic): BinaryArithmetic {
  return (left, right) => {
    if (typeof left !== 'string' && typeof right !== 'string') return arithmetic(left, right);
    if (
      Array.isArray(left) ||
      Array.isArray(right) ||
      isCompatBridgeMatrix(left) ||
      isCompatBridgeMatrix(right)
    ) {
      return arithmetic(
        typeof left === 'string' ? _number(left) : left,
        typeof right === 'string' ? _number(right) : right
      );
    }
    return scalar(left, right);
  };
}

export const add = makeArithmetic(
  withNumericText(_add as BinaryArithmetic, _addScalar),
  _matAdd as (a: unknown, b: unknown) => unknown,
  true,
  (a, b) => a + b
) as NumericStringArithmetic & PublicAdd & OneArg;
export const subtract = makeArithmetic(
  _subtract as (a: unknown, b: unknown) => unknown,
  _matSubtract as (a: unknown, b: unknown) => unknown,
  true
) as typeof _subtract;
export const multiply = makeArithmetic(
  withNumericText(_multiply as BinaryArithmetic, _multiplyScalar),
  _matMultiply as (a: unknown, b: unknown) => unknown,
  false,
  (a, b) => a * b
) as NumericStringArithmetic & typeof _multiply;
/**
 * `divide(a, b)` is `multiply(a, inv(b))` (mathjs). Two native `DenseMatrix` operands give a native
 * `DenseMatrix`, as `inv`, `sqrtm` and the matrix path of `add` and `multiply` do: the typed
 * function gives the boxed class for every matrix operand. Every other call goes to the typed
 * function.
 */
export const divide = withTypedSurface(function (a?: unknown, b?: unknown): unknown {
  if (arguments.length === 2 && isDenseMatrix(a) && isDenseMatrix(b)) {
    return _matMultiply(a, _inv(b) as DenseMatrix);
  }
  // The mathjs-shaped factory carries the 15.3.0 sparse semantics (a sparse result only
  // when the image of zero is zero, #1565); the typed surface keeps its older sparse path.
  return (_factoryDivide as unknown as (...args: unknown[]) => unknown).apply(
    undefined,
    arguments as unknown as unknown[]
  );
}, _divide) as TypedFunction;
function powWithFractionOperands(base: unknown, exponent: unknown, predictable: boolean): unknown {
  const toFractionOperand = (v: unknown): Fraction | null => {
    if (isFraction(v)) return v;
    if (typeof v === 'number' && Number.isFinite(v)) return fraction(v);
    return null;
  };
  const b = toFractionOperand(base);
  const e = toFractionOperand(exponent);
  if (b != null && e != null) {
    return mathjsPowFractionPair(b, e, predictable, (n) => fraction(n));
  }
  return _factoryPow(base, exponent);
}

/**
 * Adapter over native `factory_pow`: mathjs principal Complex roots (and
 * `predictable` throws) for a negative Fraction with a non-integer exponent.
 */
export function createCompatPow(predictable: () => boolean): TypedFunction {
  return withTypedSurface(
    function (base?: unknown, exponent?: unknown): unknown {
      if (arguments.length === 2 && (isFraction(base) || isFraction(exponent))) {
        return powWithFractionOperands(base, exponent, Boolean(predictable()));
      }
      return _factoryPow.apply(undefined, arguments as unknown as unknown[]);
    },
    _factoryPow as unknown as TypedFunction
  ) as TypedFunction;
}

/** Default `pow` shim (singleton config); instances should use `createCompatPow`. */
export const pow = createCompatPow(() => Boolean(config().predictable));

/** Native Fraction predicates (sign/integrality from `numerator` / `denominator`). */
export const isPositive = _isPositive as unknown as TypedFunction;
export const isNegative = _isNegative as unknown as TypedFunction;
export const isInteger = _isInteger as unknown as TypedFunction;
export const fix = _fix as unknown as TypedFunction;

/**
 * mathjs prints whole Fractions as `n/1` in `format` (native MathTS uses `n` only, #1579).
 */
function mathjsRatioFraction(value: Fraction): string {
  return `${value.numerator}/${value.denominator}`;
}

function formatMathjsTree(value: unknown, options?: unknown): string {
  const opts = options as { fraction?: string } | undefined;
  const useRatio = !opts || typeof opts !== 'object' || opts.fraction !== 'decimal';
  if (isFraction(value) && useRatio) return mathjsRatioFraction(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => formatMathjsTree(entry, options)).join(', ')}]`;
  }
  if (value == null || (typeof value !== 'object' && typeof value !== 'function')) {
    return _format(value, options);
  }
  const storage = (value as { storage?: unknown }).storage;
  const sparseStorage =
    isSparseMatrix(value) ||
    (typeof storage === 'function' && (storage as () => string).call(value) === 'sparse');
  if (sparseStorage) return _format(value, options);
  if (isCompatBridgeMatrix(value)) {
    const matrix = value as { toArray?: () => unknown };
    if (typeof matrix.toArray === 'function') {
      return formatMathjsTree(matrix.toArray(), options);
    }
  }
  return _format(value, options);
}

/** mathjs-compatible `format`: whole Fractions print as `n/1`. */
export function format(value: unknown, options?: unknown): string {
  return formatMathjsTree(value, options);
}
// sqrt and log leave the real domain for x < 0 (they return Complex there).
export const sqrt = makeUnaryFastPath(
  factory_mathjsCompat.sqrt as (...args: unknown[]) => unknown,
  UNARY_NUMBER_FAST_PATH.sqrt
) as PublicSqrt;
export const abs = makeUnaryFastPath(
  _abs as (...args: unknown[]) => unknown,
  UNARY_NUMBER_FAST_PATH.abs
) as PublicAbs;
export const exp = makeUnaryFastPath(
  _exp as (...args: unknown[]) => unknown,
  UNARY_NUMBER_FAST_PATH.exp
) as PublicExp;
export const log = makeUnaryFastPath(
  _log as (...args: unknown[]) => unknown,
  UNARY_NUMBER_FAST_PATH.log
) as PublicLog;

// =============================================================================
// Trigonometric Function Shims
// =============================================================================

export const sin = makeUnaryFastPath(
  _sin as (...args: unknown[]) => unknown,
  UNARY_NUMBER_FAST_PATH.sin
) as PublicSin;
export const cos = makeUnaryFastPath(
  _cos as (...args: unknown[]) => unknown,
  UNARY_NUMBER_FAST_PATH.cos
) as PublicCos;
export const tan = makeUnaryFastPath(
  _tan as (...args: unknown[]) => unknown,
  UNARY_NUMBER_FAST_PATH.tan
) as PublicTan;

// Inverse trig — delegate to functions typed implementations (complex promotion).
// asin and acos leave the real domain [-1, 1] to the typed function (it returns Complex there).
export const asin: TypedFunction = makeUnaryFastPath(
  _asin as (...args: unknown[]) => unknown,
  UNARY_NUMBER_FAST_PATH.asin
) as unknown as TypedFunction;
export const acos: TypedFunction = makeUnaryFastPath(
  _acos as (...args: unknown[]) => unknown,
  UNARY_NUMBER_FAST_PATH.acos
) as unknown as TypedFunction;
export const atan: TypedFunction = makeUnaryFastPath(
  _atan as (...args: unknown[]) => unknown,
  UNARY_NUMBER_FAST_PATH.atan
) as unknown as TypedFunction;
export const atan2: TypedFunction = _atan2;

// =============================================================================
// Statistical Function Shims
// =============================================================================

export const sum: TypedFunction = _sum;
export const mean = _mean as PublicMean;

/**
 * The variance of the values in the data. This is the functions implementation: it defaults to
 * the unbiased divisor (N - 1), as mathjs does, and it takes the dimension, the variadic form
 * and BigNumber data. Subnormal squares and squares that overflow keep every digit (#1280).
 */
export const variance = _variance as PublicVariance;

/**
 * The standard deviation of the values in the data. This is the functions implementation, with
 * the same arguments as {@link variance}.
 */
export const std = withTypedSurface(function (...args: unknown[]): unknown {
  const result = (_std as (...values: unknown[]) => unknown)(...args);
  const source = args[0];
  if (!Array.isArray(result) || !isCompatBridgeMatrix(source)) return result;
  const boxed = source as { storage?: () => string };
  const sparse = isSparseMatrix(source) || boxed.storage?.() === 'sparse';
  return _factoryMatrix(result, sparse ? 'sparse' : 'dense');
}, _std) as PublicStd;
export const min: TypedFunction = _min;
export const max: TypedFunction = _max;

// =============================================================================
// Number Theory Shims
// =============================================================================

export const gcd: TypedFunction = _gcd;
export const lcm: TypedFunction = _lcm;

// =============================================================================
// Rounding Shims
// =============================================================================

export const round: TypedFunction = _round;
export const floor: TypedFunction = _floor;
export const ceil: TypedFunction = _ceil;

// =============================================================================
// Complex-specific Shims
// =============================================================================

type ComplexProjection = {
  (value: Complex | number): number;
  (value: readonly unknown[]): unknown[];
  (value: unknown): unknown;
};

/** Complex conjugate applied elementwise to collections. */
export const conj = factory_mathjsCompat.conj as {
  (value: Complex): Complex;
  (value: number): number;
  (value: readonly unknown[]): unknown[];
  (value: unknown): unknown;
};

/** Real part applied elementwise to collections. */
export const re = factory_mathjsCompat.re as ComplexProjection;

/** Imaginary part applied elementwise to collections. */
export const im = factory_mathjsCompat.im as ComplexProjection;

/** Complex phase applied elementwise to collections. */
export const arg = factory_mathjsCompat.arg as ComplexProjection;

// =============================================================================
// Matrix-specific Shims
// =============================================================================

type MatrixScalar = number | bigint | boolean | string | null | BigNumber | Complex | Fraction;

/** Transpose native matrices with their own backend and other values with the mathjs factory. */
export function transpose<T extends MatrixScalar>(m: T): T;
export function transpose<T>(m: T[]): T[];
export function transpose(m: CompatMatrixValue): CompatMatrixValue;
export function transpose(m: unknown): unknown {
  if (isDenseMatrix(m) || isSparseMatrix(m)) return m.transpose();
  return _transpose(m);
}

/** Compute the determinant with typed scalar arithmetic, preserving fractional and complex values. */
export function det(m: DenseMatrix | number[][]): number;
export function det<T extends MatrixScalar>(m: T): T;
export function det(m: unknown): ReturnType<typeof _det>;
export function det(m: unknown): unknown {
  if (isSparseMatrix(m)) throw new TypeError('Expected DenseMatrix or 2D array');
  if (isDenseMatrix(m)) {
    if (m.rows !== m.cols) throw notSquareError('Determinant requires a square matrix');
    return _det(m.toArray());
  }
  return _det(m);
}

/**
 * Identity matrix (mathjs-compatible)
 */
export function identity(n: number): DenseMatrix {
  return DenseMatrix.identity(n);
}

/**
 * Zeros (mathjs-compatible).
 *
 * Two forms keep the compat contract: `zeros(n)` is a length-`n` `number[]` (the size is
 * `[n]`, as `math.zeros(3).toArray()` is `[0,0,0]` in mathjs) and `zeros(r, c)` is a native
 * `r×c` DenseMatrix. Every other form goes to the functions `zeros`, which returns the mathjs
 * shape: an Array size (`zeros([2, 3, 2])`, an Array), three or more sizes
 * (`zeros(2, 3, 2)`, a matrix of size `[2, 3, 2]`) and a trailing format (`zeros(2, 2, 'sparse')`).
 */
export function zeros(rows: number, cols?: number): DenseMatrix | number[];
export function zeros(...args: unknown[]): CompatMatrixValue | unknown[];
export function zeros(...args: unknown[]): unknown {
  return filled(args, 0, _factoryZeros as (...a: unknown[]) => unknown);
}

/**
 * Ones (mathjs-compatible).
 *
 * The forms are those of {@link zeros}: `ones(n)` is a `number[]`, `ones(r, c)` a native
 * `r×c` DenseMatrix, and every other form goes to the functions `ones`.
 */
export function ones(rows: number, cols?: number): DenseMatrix | number[];
export function ones(...args: unknown[]): CompatMatrixValue | unknown[];
export function ones(...args: unknown[]): unknown {
  return filled(args, 1, _factoryOnes as (...a: unknown[]) => unknown);
}

/** The shared body of `zeros` and `ones`: the two compat forms, else the functions factory. */
function filled(args: unknown[], value: 0 | 1, factory: (...a: unknown[]) => unknown): unknown {
  const [rows, cols] = args;
  if (typeof rows === 'number' && args.length <= 2) {
    if (cols === undefined) return new Array<number>(rows).fill(value);
    if (typeof cols === 'number') {
      return value === 0 ? DenseMatrix.zeros(rows, cols) : DenseMatrix.ones(rows, cols);
    }
  }
  return factory(...args);
}

/** Return the dimensions of a scalar, string, array, or matrix. */
export function size(value: unknown): number[] {
  return _size(value);
}

// =============================================================================
// Type Checking Shims
// =============================================================================

/**
 * Return `true` if `x` is a Complex. This shim calls the core `isComplex` check.
 *
 * @param x - The value to check.
 * @returns `true` if `x` is a Complex.
 */
export function isComplex_(x: unknown): x is Complex {
  return isComplex(x);
}

/**
 * Return `true` if `x` is a Fraction. This shim calls the core `isFraction` check.
 *
 * @param x - The value to check.
 * @returns `true` if `x` is a Fraction.
 */
export function isFraction_(x: unknown): x is Fraction {
  return isFraction(x);
}

/**
 * Return `true` if `x` is a BigNumber. This shim calls the core `isBigNumber` check.
 *
 * @param x - The value to check.
 * @returns `true` if `x` is a BigNumber.
 */
export function isBigNumber_(x: unknown): x is BigNumber {
  return isBigNumber(x);
}

/**
 * Return `true` if `x` is a number. This shim calls the core `isNumber` check.
 *
 * @param x - The value to check.
 * @returns `true` if `x` is a number.
 */
export function isNumber_(x: unknown): x is number {
  return isNumber(x);
}

/**
 * Return `true` if `x` is a DenseMatrix or a SparseMatrix instance.
 *
 * A nested array gives `false`.
 *
 * @param x - The value to check.
 * @returns `true` if `x` is a DenseMatrix or a SparseMatrix.
 */
export function isMatrix(x: unknown): x is DenseMatrix | SparseMatrix {
  return isCompatBridgeMatrix(x);
}

// =============================================================================
// Constants (mathjs-compatible)
// =============================================================================

export const i = I;
export const pi = Math.PI;
export const e = Math.E;
export const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
export const tau = 2 * Math.PI;
export const LN2 = CORE_LN2;
export const LN10 = CORE_LN10;
export const LOG2E = CORE_LOG2E;
export const LOG10E = CORE_LOG10E;
export const SQRT2 = CORE_SQRT2;
export const SQRT1_2 = CORE_SQRT1_2;
export const Infinity_ = Infinity;
export const NaN_ = NaN;

// =============================================================================
// Export all shims
// =============================================================================

const _shims = {
  // Type creation
  complex,
  fraction,
  bignumber,
  matrix,
  sparse,

  // Arithmetic
  add,
  subtract,
  multiply,
  divide,
  pow,
  format,
  isPositive,
  isNegative,
  isInteger,
  fix,
  sqrt,
  abs,
  exp,
  log,

  // Trigonometry
  sin,
  cos,
  tan,
  asin,
  acos,
  atan,
  atan2,

  // Statistics
  sum,
  mean,
  std,
  variance,
  min,
  max,

  // Number theory
  gcd,
  lcm,

  // Rounding
  round,
  floor,
  ceil,

  // Complex-specific
  conj,
  re,
  im,
  arg,

  // Matrix-specific
  transpose,
  det,
  identity,
  zeros,
  ones,
  size,

  // Type checking
  isComplex: isComplex_,
  isFraction: isFraction_,
  isBigNumber: isBigNumber_,
  isNumber: isNumber_,
  isMatrix,

  // Constants
  i,
  pi,
  e,
  phi,
  tau,
  LN2,
  LN10,
  LOG2E,
  LOG10E,
  SQRT2,
  SQRT1_2,
  Infinity: Infinity_,
  NaN: NaN_,
};

export const shims: Omit<typeof _shims, 'add' | 'sin'> & {
  add: NumericStringArithmetic & PublicAdd;
  sin: PublicSin;
} = _shims;
