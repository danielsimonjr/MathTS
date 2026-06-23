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
} from '@danielsimonjr/mathts-core';

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
  sum as _sum,
  mean as _mean,
  min as _min,
  max as _max,
  gcd as _gcd,
  lcm as _lcm,
  round as _round,
  floor as _floor,
  ceil as _ceil,
} from '@danielsimonjr/mathts-functions';

import {
  DenseMatrix,
  SparseMatrix,
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
 */
export function complex(re?: number | string | Complex, im?: number): Complex {
  if (re === undefined) {
    return COMPLEX_ZERO;
  }
  if (re instanceof Complex) {
    return re;
  }
  if (typeof re === 'string') {
    return Complex.parse(re);
  }
  return new Complex(re, im ?? 0);
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
  if (numerator instanceof Fraction) {
    return numerator;
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
 * Create a BigNumber (mathjs-compatible)
 * @example
 * bignumber('123.456')
 * bignumber(123)
 */
export function bignumber(value?: number | string | BigNumber): BigNumber {
  if (value === undefined) {
    return BigNumber.fromNumber(0);
  }
  if (value instanceof BigNumber) {
    return value;
  }
  if (typeof value === 'string') {
    return BigNumber.parse(value);
  }
  return BigNumber.fromNumber(value);
}

/**
 * Create a matrix (mathjs-compatible)
 * @example
 * matrix([[1,2],[3,4]])
 * matrix([[1,2],[3,4]], 'sparse')
 */
export function matrix(
  data?: number[][] | DenseMatrix | SparseMatrix,
  format?: 'dense' | 'sparse'
): DenseMatrix | SparseMatrix {
  if (data === undefined) {
    return DenseMatrix.zeros(0, 0);
  }
  if (data instanceof DenseMatrix || data instanceof SparseMatrix) {
    return data;
  }
  const dense = DenseMatrix.fromArray(data);
  if (format === 'sparse') {
    return SparseMatrix.fromDense(dense);
  }
  return dense;
}

/**
 * Create a sparse matrix (mathjs-compatible)
 */
export function sparse(data?: number[][]): SparseMatrix {
  if (data === undefined) {
    return SparseMatrix.zeros(0, 0);
  }
  return SparseMatrix.fromDense(DenseMatrix.fromArray(data));
}

// =============================================================================
// Arithmetic Function Shims
// =============================================================================

// add/subtract/multiply must be matrix-aware for mathjs parity: the
// functions-package versions are scalar-only and throw on number[][]. Delegate
// 2-D array / DenseMatrix operands to the matrix package, scalars to functions.
type MatrixLike = number[][] | DenseMatrix;

const isMatrixLike = (x: unknown): x is MatrixLike =>
  x instanceof DenseMatrix ||
  (Array.isArray(x) && x.length > 0 && Array.isArray((x as unknown[])[0]));

const toDenseMatrix = (x: MatrixLike): DenseMatrix =>
  x instanceof DenseMatrix ? x : DenseMatrix.fromArray(x as number[][]);

const unwrap = (r: unknown): unknown =>
  r instanceof DenseMatrix ? r.toArray() : r;

const applyArithmetic = (
  scalarFn: (a: unknown, b: unknown) => unknown,
  matrixFn: (a: unknown, b: unknown) => unknown,
  a: unknown,
  b: unknown,
): unknown => {
  if (isMatrixLike(a) || isMatrixLike(b)) {
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
const makeArithmetic = (
  scalarFn: (a: unknown, b: unknown) => unknown,
  matrixFn: (a: unknown, b: unknown) => unknown,
) => (...args: unknown[]): unknown => {
  if (args.length === 0) {
    throw new TypeError('Too few arguments (expected at least 1)');
  }
  if (args.length === 1) {
    return args[0];
  }
  return args.reduce((acc, next) => applyArithmetic(scalarFn, matrixFn, acc, next));
};

export const add = makeArithmetic(
  _add as (a: unknown, b: unknown) => unknown,
  _matAdd as (a: unknown, b: unknown) => unknown,
) as typeof _add;
export const subtract = makeArithmetic(
  _subtract as (a: unknown, b: unknown) => unknown,
  _matSubtract as (a: unknown, b: unknown) => unknown,
) as typeof _subtract;
export const multiply = makeArithmetic(
  _multiply as (a: unknown, b: unknown) => unknown,
  _matMultiply as (a: unknown, b: unknown) => unknown,
) as typeof _multiply;
export const divide = _divide;
export const pow = _pow;
export const sqrt = _sqrt;
export const abs = _abs;
export const exp = _exp;
export const log = _log;

// =============================================================================
// Trigonometric Function Shims
// =============================================================================

export const sin = _sin;
export const cos = _cos;
export const tan = _tan;

// Inverse trig (shims - these may not be fully implemented in MathTS yet)
export function asin(x: number): number {
  return Math.asin(x);
}

export function acos(x: number): number {
  return Math.acos(x);
}

export function atan(x: number): number {
  return Math.atan(x);
}

export function atan2(y: number, x: number): number {
  return Math.atan2(y, x);
}

// =============================================================================
// Statistical Function Shims
// =============================================================================

export const sum = _sum;
export const mean = _mean;

// std/variance must match mathjs defaults — 'unbiased' (sample, ÷(N-1)). The
// functions-package versions default to population (÷N) and reject a
// normalization argument, so compat overrides them for mathjs parity.
type Normalization = 'unbiased' | 'uncorrected' | 'biased';

function toNumericArray(data: unknown): number[] {
  if (data instanceof DenseMatrix) return (data.toArray().flat(Infinity) as number[]);
  if (Array.isArray(data)) return ((data as unknown[]).flat(Infinity) as number[]);
  return [data as number];
}

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

export function std(data: unknown, normalization: Normalization = 'unbiased'): number {
  return Math.sqrt(variance(data, normalization));
}
export const min = _min;
export const max = _max;

// =============================================================================
// Number Theory Shims
// =============================================================================

export const gcd = _gcd;
export const lcm = _lcm;

// =============================================================================
// Rounding Shims
// =============================================================================

export const round = _round;
export const floor = _floor;
export const ceil = _ceil;

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
export function transpose(
  m: DenseMatrix | SparseMatrix | number[][]
): DenseMatrix | SparseMatrix | number[][] {
  if (Array.isArray(m)) {
    return DenseMatrix.fromArray(m).transpose().toArray();
  }
  return m.transpose();
}

/**
 * Matrix determinant (mathjs-compatible)
 *
 * Computes the determinant using LU decomposition.
 */
export function det(m: DenseMatrix | number[][]): number {
  const matrix = Array.isArray(m) ? DenseMatrix.fromArray(m) : m;

  if (!(matrix instanceof DenseMatrix)) {
    throw new TypeError('Expected DenseMatrix or 2D array');
  }

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
 * Zeros matrix (mathjs-compatible)
 */
export function zeros(rows: number, cols?: number): DenseMatrix {
  return DenseMatrix.zeros(rows, cols ?? rows);
}

/**
 * Ones matrix (mathjs-compatible)
 */
export function ones(rows: number, cols?: number): DenseMatrix {
  return DenseMatrix.ones(rows, cols ?? rows);
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

export function isComplex_(x: unknown): x is Complex {
  return isComplex(x);
}

export function isFraction_(x: unknown): x is Fraction {
  return isFraction(x);
}

export function isBigNumber_(x: unknown): x is BigNumber {
  return isBigNumber(x);
}

export function isNumber_(x: unknown): x is number {
  return isNumber(x);
}

export function isMatrix(x: unknown): x is DenseMatrix | SparseMatrix {
  return x instanceof DenseMatrix || x instanceof SparseMatrix;
}

// =============================================================================
// Constants (mathjs-compatible)
// =============================================================================

export const i = I;
export const pi = Math.PI;
export const e = Math.E;
export const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
export const tau = 2 * Math.PI;
export const LN2 = Math.LN2;
export const LN10 = Math.LN10;
export const LOG2E = Math.LOG2E;
export const LOG10E = Math.LOG10E;
export const SQRT2 = Math.SQRT2;
export const SQRT1_2 = Math.SQRT1_2;
export const Infinity_ = Infinity;
export const NaN_ = NaN;

// =============================================================================
// Export all shims
// =============================================================================

export const shims = {
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
