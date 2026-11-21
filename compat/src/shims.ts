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
  PublicAbs,
  PublicAdd,
  PublicCos,
  PublicExp,
  PublicLog,
  PublicMean,
  PublicSin,
  PublicSqrt,
  PublicTan,
} from '@danielsimonjr/mathts-functions';

import {
  add as _add,
  subtract as _subtract,
  multiply as _multiply,
  divide as _divide,
  pow as _pow,
  sqrt as _sqrt,
  abs as _abs,
  exp as _exp,
  log as _log,
  sin as _sin,
  cos as _cos,
  tan as _tan,
  asin as _asin,
  acos as _acos,
  atan as _atan,
  atan2 as _atan2,
  sum as _sum,
  mean as _mean,
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
  transpose as _transpose,
  bignumber as _bignumber,
  complex as _complex,
} from '@danielsimonjr/mathts-functions';

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

/**
 * Create a fraction (mathjs-compatible)
 * @example
 * fraction(1, 2)   // Fraction(1, 2)
 * fraction('1/2')  // Fraction(1, 2)
 * fraction(0.5)    // Fraction(1, 2)
 */
export function fraction(numerator?: number | string | Fraction, denominator?: number): Fraction {
  if (numerator === undefined) {
    return new Fraction(0, 1);
  }
  if (isFraction(numerator)) {
    return numerator as Fraction;
  }
  if (typeof numerator === 'string') {
    return Fraction.parse(numerator);
  }
  if (denominator !== undefined) {
    return new Fraction(numerator, denominator);
  }
  return Fraction.fromNumber(numerator);
}

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
    return BigNumber.fromNumber(0);
  }
  return _bignumber(value as object);
}

/** Matrix values returned from the compat `matrix` shim (native or mathjs bridge). */
export type CompatMatrixValue =
  | DenseMatrix
  | SparseMatrix
  | {
      isMatrix: boolean;
      toArray(): unknown;
      subset(...args: unknown[]): unknown;
      get(...args: unknown[]): unknown;
      transpose(): CompatMatrixValue;
      rows: number;
      cols: number;
    };

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

/**
 * A native `DenseMatrix` of the nested data `arr`. `DenseMatrix.fromArray` holds no empty axis,
 * and the nested data of a matrix with a zero axis does not show its size (`[]` is 0 x 3 as well
 * as 0 x 0). So the size of the operand `m` decides the empty case.
 */
function denseOfNested(arr: unknown[], m: unknown): DenseMatrix {
  const size = axesOf(m);
  if (size !== null && size.length === 2 && size[0] * size[1] === 0) {
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
export function matrix(
  data?: number[] | number[][] | DenseMatrix | SparseMatrix,
  format?: 'dense' | 'sparse' | string
): CompatMatrixValue {
  if (arguments.length === 0) {
    return _factoryMatrix() as CompatMatrixValue;
  }
  if (isDenseMatrix(data) || isSparseMatrix(data)) {
    // A native matrix of the format that is asked for, or of no format, is returned as it is.
    if (format === undefined) return data;
    // The factory checks the format, so an unknown one throws the mathjs TypeError here too.
    _factoryMatrix([], format);
    if (format === 'sparse' && isDenseMatrix(data)) {
      return _factorySparse(data.toArray()) as CompatMatrixValue;
    }
    if (format !== 'sparse' && isSparseMatrix(data)) {
      return DenseMatrix.fromArray(data.toArray());
    }
    return data;
  }
  // An explicit undefined data argument reaches the factory, which throws the mathjs TypeError.
  return _factoryMatrix(data as number[][], format) as CompatMatrixValue;
}

/**
 * Create a sparse matrix (mathjs-compatible)
 */
export function sparse(data?: number[][]): CompatMatrixValue {
  if (data === undefined) {
    return _factorySparse() as CompatMatrixValue;
  }
  return _factorySparse(data) as CompatMatrixValue;
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
  if (size !== null && size.length === 2 && size[0] * size[1] === 0) return r;
  return (r as { toArray(): unknown }).toArray();
};

/** The axis lengths of an Array or a matrix operand, read along the first elements; null for a scalar. */
const axesOf = (x: unknown): number[] | null => {
  if (isDenseMatrix(x) || isSparseMatrix(x)) return [x.rows, x.cols];
  if (isCompatBridgeMatrix(x)) return (x as unknown as { size(): number[] }).size();
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
  if (isMatrixLike(a) || isMatrixLike(b)) {
    if (!matrixPackageCanTake(a, b, elementwise)) return unwrap(scalarFn(a, b));
    const aa = isMatrixLike(a) ? toDenseMatrix(a) : a;
    const bb = isMatrixLike(b) ? toDenseMatrix(b) : b;
    return unwrap(matrixFn(aa, bb));
  }
  return scalarFn(a, b);
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
  // The shim keeps the typed function's surface (name, length, signatures, ...).
  for (const key of Reflect.ownKeys(scalarFn)) {
    if (key === 'prototype') continue;
    const desc = Object.getOwnPropertyDescriptor(scalarFn, key);
    if (desc) Object.defineProperty(fast, key, desc);
  }
  return fast;
};

type OneArg = <T>(value: T) => T;
export const add = makeArithmetic(
  _add as (a: unknown, b: unknown) => unknown,
  _matAdd as (a: unknown, b: unknown) => unknown,
  true,
  (a, b) => a + b
) as PublicAdd & OneArg;
export const subtract = makeArithmetic(
  _subtract as (a: unknown, b: unknown) => unknown,
  _matSubtract as (a: unknown, b: unknown) => unknown,
  true
) as typeof _subtract;
export const multiply = makeArithmetic(
  _multiply as (a: unknown, b: unknown) => unknown,
  _matMultiply as (a: unknown, b: unknown) => unknown,
  false,
  (a, b) => a * b
) as typeof _multiply;
export const divide: TypedFunction = _divide;
export const pow: TypedFunction = _pow;
// sqrt and log leave the real domain for x < 0 (they return Complex there).
export const sqrt = makeUnaryFastPath(
  _sqrt as (...args: unknown[]) => unknown,
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

// std/variance must match mathjs defaults — 'unbiased' (sample, ÷(N-1)). The
// functions-package versions now also default to unbiased and accept a
// normalization argument (GC1), but compat keeps a self-contained override so it
// can flatten DenseMatrix / nested-array inputs that the typed Array/Float64Array
// signatures don't cover.
type Normalization = 'unbiased' | 'uncorrected' | 'biased';

function toNumericArray(data: unknown): number[] {
  if (isCompatBridgeMatrix(data)) {
    const flat = (data as { toArray(): unknown }).toArray();
    return (Array.isArray(flat) ? flat : [flat]).flat(Infinity) as number[];
  }
  if (Array.isArray(data)) return (data as unknown[]).flat(Infinity) as number[];
  return [data as number];
}

/**
 * Return the variance of all values in `data`.
 *
 * This function flattens a DenseMatrix or a nested array to one list.
 * It uses any other input as a list of one value.
 * An empty list gives `NaN`.
 * The divisor is N - 1 for `'unbiased'` (N for one value), N for `'uncorrected'` and N + 1 for `'biased'`.
 *
 * @param data - A number, a DenseMatrix or a nested array of numbers.
 * @param normalization - The divisor rule. The default is `'unbiased'`, as in mathjs.
 * @returns The variance.
 */
export function variance(data: unknown, normalization: Normalization = 'unbiased'): number {
  const arr = toNumericArray(data);
  const n = arr.length;
  if (n === 0) return NaN;
  const mu = arr.reduce((s, x) => s + x, 0) / n;
  const ss = arr.reduce((s, x) => s + (x - mu) * (x - mu), 0);
  const denom =
    normalization === 'uncorrected' ? n : normalization === 'biased' ? n + 1 : n > 1 ? n - 1 : n;
  return ss / denom;
}

/**
 * Return the standard deviation of all values in `data`.
 *
 * The result is the square root of `variance(data, normalization)`.
 *
 * @param data - A number, a DenseMatrix or a nested array of numbers.
 * @param normalization - The divisor rule. The default is `'unbiased'`, as in mathjs.
 * @returns The standard deviation.
 */
export function std(data: unknown, normalization: Normalization = 'unbiased'): number {
  return Math.sqrt(variance(data, normalization));
}
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

/**
 * Complex conjugate (mathjs-compatible)
 */
export function conj(c: Complex): Complex {
  if (!isComplex(c)) {
    throw new TypeError('Expected Complex number');
  }
  return c.conjugate();
}

/**
 * Real part (mathjs-compatible)
 */
export function re(c: Complex | number): number {
  if (typeof c === 'number') return c;
  if (isComplex(c)) return c.re;
  throw new TypeError('Expected Complex or number');
}

/**
 * Imaginary part (mathjs-compatible)
 */
export function im(c: Complex | number): number {
  if (typeof c === 'number') return 0;
  if (isComplex(c)) return c.im;
  throw new TypeError('Expected Complex or number');
}

/**
 * Argument (phase) of complex number (mathjs-compatible)
 */
export function arg(c: Complex): number {
  if (!isComplex(c)) {
    throw new TypeError('Expected Complex number');
  }
  return c.arg();
}

// =============================================================================
// Matrix-specific Shims
// =============================================================================

/**
 * Transpose matrix (mathjs-compatible). Array in → array out (mathjs returns a
 * plain nested array for array input, a Matrix for Matrix input).
 */
export function transpose(m: CompatMatrixValue | number[][]): CompatMatrixValue | number[][] {
  if (Array.isArray(m)) {
    return DenseMatrix.fromArray(m).transpose().toArray();
  }
  if (isDenseMatrix(m) || isSparseMatrix(m)) {
    return m.transpose();
  }
  if (isCompatBridgeMatrix(m)) {
    // The factory transpose takes the dense and the sparse matrix of the factory layer.
    return _transpose(m as unknown) as CompatMatrixValue;
  }
  throw new TypeError('Expected matrix or 2D array');
}

/**
 * Matrix determinant (mathjs-compatible)
 *
 * Computes the determinant using LU decomposition.
 */
export function det(m: CompatMatrixValue | number[][]): number {
  // The matrix-package SparseMatrix was rejected before this compat surface
  // routed math.matrix/math.sparse through the factory bridge. mathjs det()
  // accepts math.sparse() (that bridge matrix, converted below via toArray).
  // The native class stays rejected so existing callers keep the same error.
  if (isSparseMatrix(m)) {
    throw new TypeError('Expected DenseMatrix or 2D array');
  }
  const matrix = compatToDenseMatrix(m);

  if (matrix.rows !== matrix.cols) {
    throw new Error('Determinant requires a square matrix');
  }

  const n = matrix.rows;

  // Handle small cases directly
  if (n === 0) return 1;
  if (n === 1) return matrix.get(0, 0);
  if (n === 2) {
    return matrix.get(0, 0) * matrix.get(1, 1) - matrix.get(0, 1) * matrix.get(1, 0);
  }
  if (n === 3) {
    const a = matrix.get(0, 0),
      b = matrix.get(0, 1),
      c = matrix.get(0, 2);
    const d = matrix.get(1, 0),
      e = matrix.get(1, 1),
      f = matrix.get(1, 2);
    const g = matrix.get(2, 0),
      h = matrix.get(2, 1),
      i = matrix.get(2, 2);
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  }

  // LU decomposition for larger matrices
  const lu: number[][] = [];
  for (let i = 0; i < n; i++) {
    lu[i] = [];
    for (let j = 0; j < n; j++) {
      lu[i][j] = matrix.get(i, j);
    }
  }

  let swaps = 0;
  for (let k = 0; k < n - 1; k++) {
    // Find pivot
    let maxVal = Math.abs(lu[k][k]);
    let maxRow = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(lu[i][k]) > maxVal) {
        maxVal = Math.abs(lu[i][k]);
        maxRow = i;
      }
    }

    if (maxVal < 1e-12) {
      return 0; // Singular matrix
    }

    // Swap rows if needed
    if (maxRow !== k) {
      [lu[k], lu[maxRow]] = [lu[maxRow], lu[k]];
      swaps++;
    }

    // Eliminate column
    for (let i = k + 1; i < n; i++) {
      lu[i][k] /= lu[k][k];
      for (let j = k + 1; j < n; j++) {
        lu[i][j] -= lu[i][k] * lu[k][j];
      }
    }
  }

  // Product of diagonal
  let result = 1;
  for (let i = 0; i < n; i++) {
    result *= lu[i][i];
  }

  return swaps % 2 === 0 ? result : -result;
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

/**
 * Matrix size (mathjs-compatible)
 */
export function size(m: DenseMatrix | SparseMatrix | number[][]): [number, number] {
  if (Array.isArray(m)) {
    return [m.length, m[0]?.length ?? 0];
  }
  return [m.rows, m.cols];
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

export const shims: Omit<typeof _shims, 'add' | 'sin'> & { add: PublicAdd; sin: PublicSin } =
  _shims;
