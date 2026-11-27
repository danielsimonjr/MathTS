import { BigNumber as CompatBigNumber, compatDecimalResult } from './bignumber.js';
import {
  tooFewArgumentsError,
  tooManyArgumentsError,
  withFixedArity,
} from './mathjs-parity-g02.js';
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

import { withMathjsComplexBinary } from './mathjs-complex.js';
import { ensureMathjsFractionToJson } from './fraction-mathjs-json.js';
import { compatComplexPow } from './mathjs-compat-pow.js';
import {
  add as _add,
  addScalar as _addScalar,
  subtract as _subtract,
  factory_subtract as _factorySubtract,
  multiply as _multiply,
  multiplyScalar as _multiplyScalar,
  dotMultiply as _dotMultiply,
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
  factory_round as _factoryRound,
  factory_floor as _factoryFloor,
  factory_ceil as _factoryCeil,
  identity as _identityFactory,
  matrix as _factoryMatrix,
  sparse as _factorySparse,
  zeros as _factoryZeros,
  ones as _factoryOnes,
  factory_transpose as _transpose,
  det as _det,
  size as _size,
  factory_mathjsCompat,
  complex as _complex,
  config,
  isPositive as _isPositive,
  isNegative as _isNegative,
  isInteger as _isInteger,
  fix as _fix,
} from '@danielsimonjr/mathts-functions';
import { mathjsPowFractionPair } from './mathjs-fraction-pow.js';
import { UNARY_NUMBER_FAST_PATH, type UnaryNumberFastPath } from './unary-fast-path.js';
import { sanitizeSparseNestedInput } from './compat-sparse-matrix.js';
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
import { mapDivideBroadcastError, mapElementwiseBroadcastError } from './g12-mathjs-parity.js';
import { withPublicFactoryScalar } from './mathjs-parity-errors.js';
import { subtractScalar as _factorySubtractScalar } from '@danielsimonjr/mathts-functions';
import { toCompatComplex } from './mathjs-complex-prototype.js';

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
    return toCompatComplex(COMPLEX_ZERO);
  }
  // The brand tests also return a value of a second copy of core unchanged (#1033).
  if (isComplex(re) && im === undefined && rest.length === 0) {
    return re instanceof Complex ? toCompatComplex(re) : (re as Complex);
  }
  // Every other input uses the functions `complex`, which follows mathjs (#1220).
  const args = im === undefined && rest.length === 0 ? [re] : [re, im, ...rest];
  return toCompatComplex((_complex as (...a: unknown[]) => Complex)(...args));
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
const fractionCore = mathTyped('fraction', factory_mathjsCompat.fraction as never, {
  '': () => new Fraction(0, 1),
  undefined: () => new Fraction(0, 1),
}) as unknown as CompatFraction;

function fractionExport(this: unknown, ...args: unknown[]): unknown {
  return ensureMathjsFractionToJson(Reflect.apply(fractionCore, this, args));
}

export const fraction = Object.assign(fractionExport, fractionCore) as CompatFraction;

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
  // #1587: mathjs bignumber takes at most one argument. Its typed dispatch
  // reports the argument-type error of the one-argument signature before the
  // arity error, so evaluate the value first and only then reject the arity.
  if (arguments.length > 1) {
    compatBignumber(value);
    throw tooManyArgumentsError('bignumber', 1, arguments.length);
  }
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
  if (Array.isArray(data)) {
    return _factorySparse(sanitizeSparseNestedInput(data as unknown[][]));
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

/** True when a nested array holds a leaf the numeric backend cannot take (#1774). */
const hasNonNumberEntry = (x: unknown): boolean => {
  if (!Array.isArray(x)) return false;
  return x.some((entry) =>
    Array.isArray(entry) ? hasNonNumberEntry(entry) : typeof entry !== 'number'
  );
};

const coerceNumericStringOperand = (x: unknown): unknown =>
  typeof x === 'string' ? _number(x) : x;

const callWithNumericStringOperands = (
  fn: (a: unknown, b: unknown) => unknown,
  a: unknown,
  b: unknown
): unknown => fn(coerceNumericStringOperand(a), coerceNumericStringOperand(b));

const applyArithmetic = (
  scalarFn: (a: unknown, b: unknown) => unknown,
  matrixFn: (a: unknown, b: unknown) => unknown,
  a: unknown,
  b: unknown,
  elementwise: boolean,
  complexFn?: (a: unknown, b: unknown) => unknown
): unknown => {
  // Boxed operands carry the storage format and may hold non-double scalar types.
  // Keep them in the typed path rather than coercing them to the numeric backend.
  if (isBoxedMatrix(a) || isBoxedMatrix(b)) {
    const boxedA = Array.isArray(a) ? _factoryMatrix(a) : a;
    const boxedB = Array.isArray(b) ? _factoryMatrix(b) : b;
    if (complexFn && (isComplex(boxedA) || isComplex(boxedB))) {
      return compatDecimalResult(complexFn(boxedA, boxedB));
    }
    return scalarFn(boxedA, boxedB);
  }
  // Riemann-sphere only for Complex scalars; number/BigNumber/bigint stay native.
  if (complexFn && (isComplex(a) || isComplex(b))) {
    return compatDecimalResult(complexFn(a, b));
  }
  if (isMatrixLike(a) || isMatrixLike(b)) {
    // A nested array with a BigNumber / Fraction / Complex leaf leaves the
    // numeric backend; the typed function keeps the scalar type (#1774).
    if ((Array.isArray(a) && hasNonNumberEntry(a)) || (Array.isArray(b) && hasNonNumberEntry(b))) {
      return unwrap(scalarFn(a, b));
    }
    if (!matrixPackageCanTake(a, b, elementwise)) {
      if (
        complexFn &&
        (Array.isArray(a) ||
          Array.isArray(b) ||
          isMatrixLike(a) ||
          isMatrixLike(b) ||
          isCompatBridgeMatrix(a) ||
          isCompatBridgeMatrix(b))
      ) {
        return unwrap(callWithNumericStringOperands(complexFn, a, b));
      }
      return unwrap(scalarFn(a, b));
    }
    const aa = isMatrixLike(a) ? toDenseMatrix(a) : a;
    const bb = isMatrixLike(b) ? toDenseMatrix(b) : b;
    return unwrap(matrixFn(aa, bb));
  }
  if ((Array.isArray(a) || Array.isArray(b)) && complexFn) {
    return unwrap(callWithNumericStringOperands(complexFn, a, b));
  }
  return compatDecimalResult(scalarFn(a, b));
};

// mathjs `add`/`subtract`/`multiply` are variadic and left-fold over all
// arguments: add(x, y, z, …) === add(add(x, y), z), …. A 2-arg-only wrapper
// silently dropped the 3rd+ operand (add(1,2,3) returned 3), which also broke
// internal callers like polynomialRoot's cubic branch. Fold over every arg.
const makeArithmetic =
  (
    name: string,
    scalarFn: (a: unknown, b: unknown) => unknown,
    matrixFn: (a: unknown, b: unknown) => unknown,
    elementwise: boolean,
    fastNumberPair?: (a: number, b: number) => number,
    complexFn?: (a: unknown, b: unknown) => unknown
  ) =>
  (...args: unknown[]): unknown => {
    if (args.length === 0) {
      throw tooFewArgumentsError(name, 0);
    }
    // #1587: mathjs rejects a lone argument ("Too few arguments in function add
    // (expected: any, index: 1)"); the compat fold used to return it as is.
    if (args.length === 1) {
      throw tooFewArgumentsError(name);
    }
    if (
      args.length === 2 &&
      fastNumberPair &&
      typeof args[0] === 'number' &&
      typeof args[1] === 'number'
    ) {
      return fastNumberPair(args[0], args[1]);
    }
    return args.reduce((acc, next) =>
      applyArithmetic(scalarFn, matrixFn, acc, next, elementwise, complexFn)
    );
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

const _compatAdd = withMathjsComplexBinary(_add as BinaryArithmetic, 'add');
const _compatSubtract = withMathjsComplexBinary(_subtract as BinaryArithmetic, 'sub');
const _compatMultiply = withMathjsComplexBinary(_multiply as BinaryArithmetic, 'mul');

const publicAddScalar = withPublicFactoryScalar('add', 'addScalar', _addScalar as BinaryArithmetic);
const publicMultiplyScalar = withPublicFactoryScalar(
  'multiply',
  'multiplyScalar',
  _multiplyScalar as BinaryArithmetic,
  {
    guardFractionBigNumber: true,
  }
);
const publicSubtractScalar = withPublicFactoryScalar(
  'subtract',
  'subtractScalar',
  _factorySubtractScalar as BinaryArithmetic
);

/** Factory scalars reject matrix operands; typed `add`/`multiply`/`subtract` keep Matrix results (#993). */
const useTypedArithmeticForPair = (a: unknown, b: unknown): boolean =>
  isCompatBridgeMatrix(a) || isCompatBridgeMatrix(b) || isBoxedMatrix(a) || isBoxedMatrix(b);

const addPairScalars = (a: unknown, b: unknown): unknown =>
  useTypedArithmeticForPair(a, b) ? _add(a, b) : publicAddScalar(a, b);

const multiplyPairScalars = (a: unknown, b: unknown): unknown => {
  if (useTypedArithmeticForPair(a, b)) return _multiply(a, b);
  if ((Array.isArray(a) && hasNonNumberEntry(a)) || (Array.isArray(b) && hasNonNumberEntry(b))) {
    return _multiply(a, b);
  }
  return publicMultiplyScalar(a, b);
};

const subtractPairScalars = (a: unknown, b: unknown): unknown =>
  useTypedArithmeticForPair(a, b) ? _subtract(a, b) : publicSubtractScalar(a, b);

function isProtoSparseMatrix(x: unknown): boolean {
  return (
    typeof x === 'object' &&
    x !== null &&
    (Object.getPrototypeOf(x) as { isSparseMatrix?: boolean } | null)?.isSparseMatrix === true
  );
}

const subtractPair = (a: unknown, b: unknown): unknown => {
  if (isProtoSparseMatrix(a) || isProtoSparseMatrix(b)) return _factorySubtract(a, b);
  // A native-class DenseMatrix operand takes the matrix package (the scalar
  // broadcast included), as the variadic fold routed it before (#1337).
  if (isDenseMatrix(a) || isDenseMatrix(b)) return _matSubtract(a, b);
  if (typeof a === 'bigint' || typeof b === 'bigint') return _factorySubtract(a, b);
  return applyArithmetic(
    subtractPairScalars,
    _matSubtract as (a: unknown, b: unknown) => unknown,
    a,
    b,
    true,
    _compatSubtract
  );
};

const addCore = makeArithmetic(
  'add',
  withNumericText(addPairScalars, addPairScalars),
  _matAdd as (a: unknown, b: unknown) => unknown,
  true,
  (a, b) => a + b,
  _compatAdd
);
export const add = withTypedSurface(function (...args: unknown[]): unknown {
  try {
    return addCore(...args);
  } catch (err) {
    if (args.length >= 2) {
      mapElementwiseBroadcastError(err, args[0], args[1]);
    }
    throw err;
  }
}, _add) as NumericStringArithmetic & PublicAdd & OneArg;
export const subtract = withTypedSurface(function (a?: unknown, b?: unknown): unknown {
  if (arguments.length < 2) throw tooFewArgumentsError('subtract', arguments.length);
  if (arguments.length > 2) throw tooManyArgumentsError('subtract', 2, arguments.length);
  return subtractPair(a, b);
}, _subtract) as typeof _subtract;
export const multiply = makeArithmetic(
  'multiply',
  withNumericText(multiplyPairScalars, multiplyPairScalars),
  _matMultiply as (a: unknown, b: unknown) => unknown,
  false,
  (a, b) => a * b,
  _compatMultiply
) as NumericStringArithmetic & typeof _multiply;
const _dotMultiplyComplex = withMathjsComplexBinary(_dotMultiply as BinaryArithmetic, 'mul');
const compatDotMultiply = withTypedSurface(
  withFixedArity('dotMultiply', 2, function dotMultiplyCompat(a: unknown, b: unknown): unknown {
    if (isComplex(a) || isComplex(b)) return _dotMultiplyComplex(a, b);
    return _dotMultiply(a, b);
  }),
  _dotMultiply
) as typeof _dotMultiply;
/**
 * `divide(a, b)` is `multiply(a, inv(b))` (mathjs). Two native `DenseMatrix` operands give a native
 * `DenseMatrix`, as `inv`, `sqrtm` and the matrix path of `add` and `multiply` do: the typed
 * function gives the boxed class for every matrix operand. Every other call goes to the typed
 * function.
 */
const _compatDivideScalar = withMathjsComplexBinary(
  ((a: unknown, b: unknown) =>
    (_factoryDivide as (x: unknown, y: unknown) => unknown)(a, b)) as BinaryArithmetic,
  'div'
);
export const divide = withTypedSurface(function (a?: unknown, b?: unknown): unknown {
  try {
    if (arguments.length === 2 && isDenseMatrix(a) && isDenseMatrix(b)) {
      return _matMultiply(a, _inv(b) as DenseMatrix);
    }
    if (arguments.length === 2 && (isComplex(a) || isComplex(b))) {
      return _compatDivideScalar(a, b);
    }
    // The mathjs-shaped factory carries the 15.3.0 sparse semantics (a sparse result only
    // when the image of zero is zero, #1565); the typed surface keeps its older sparse path.
    return (_factoryDivide as unknown as (...args: unknown[]) => unknown).apply(
      undefined,
      arguments as unknown as unknown[]
    );
  } catch (err) {
    mapDivideBroadcastError(err, b);
  }
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
 * Complex×Complex uses complex.js `pow` (#1589).
 */
export function createCompatPow(predictable: () => boolean): TypedFunction {
  return withTypedSurface(
    function (base?: unknown, exponent?: unknown): unknown {
      if (arguments.length === 2 && isComplex(base) && isComplex(exponent)) {
        return compatComplexPow(base, exponent);
      }
      if (
        arguments.length === 2 &&
        (Array.isArray(base) || isCompatBridgeMatrix(base)) &&
        (typeof exponent === 'number' ||
          typeof exponent === 'bigint' ||
          isBigNumber(exponent) ||
          isFraction(exponent)) &&
        Number(exponent) < 0
      ) {
        return _factoryPow(base, exponent);
      }
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
  // A matrix operand makes the result a collection; re-box it with the storage
  // of the operand. The varargs dispatch (#1550) may nest the argument list one
  // level, so look through one level of arrays for the operand.
  const source = args
    .flat()
    .find((a) => typeof a === 'object' && a !== null && isCompatBridgeMatrix(a));
  if (!Array.isArray(result) || source === undefined) return result;
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

// #1550: the mathjs-shaped factories, not the one-argument typed surface —
// mathjs ceil/floor/fix/round take (x, digits?) and a Unit.
export const round: TypedFunction = _factoryRound as unknown as TypedFunction;
export const floor: TypedFunction = _factoryFloor as unknown as TypedFunction;
export const ceil: TypedFunction = _factoryCeil as unknown as TypedFunction;

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
  // #1587: mathjs transpose takes exactly one argument.
  if (arguments.length < 1) throw tooFewArgumentsError('transpose', arguments.length);
  if (arguments.length > 1) {
    throw tooManyArgumentsError('transpose', 1, arguments.length);
  }
  if (isDenseMatrix(m) || isSparseMatrix(m)) return m.transpose();
  return _transpose(m);
}

/** Compute the determinant with typed scalar arithmetic, preserving fractional and complex values. */
export function det(m: DenseMatrix | number[][]): number;
export function det<T extends MatrixScalar>(m: T): T;
export function det(m: unknown): ReturnType<typeof _det>;
export function det(m: unknown): unknown {
  // #1587: mathjs det takes exactly one argument.
  if (arguments.length < 1) throw tooFewArgumentsError('det', arguments.length);
  if (arguments.length > 1) {
    throw tooManyArgumentsError('det', 1, arguments.length);
  }
  if (isSparseMatrix(m)) throw new TypeError('Expected DenseMatrix or 2D array');
  if (isDenseMatrix(m)) {
    if (m.rows !== m.cols) throw notSquareError('Determinant requires a square matrix');
    return _det(m.toArray());
  }
  return _det(m);
}

/**
 * Identity matrix (mathjs-compatible).
 *
 * #1550: the mathjs-shaped factory — `identity(m, n)` is m×n, `identity()` is an
 * empty DenseMatrix and `identity([m, n])` an Array, as in mathjs.
 */
export const identity: TypedFunction = _identityFactory as unknown as TypedFunction;

/**
 * Zeros (mathjs-compatible).
 *
 * #1550: the mathjs-shaped factory. `zeros(n)` is a DenseMatrix of size `[n]`
 * (mathjs returns a Matrix under the default `matrix: 'Matrix'` config), and
 * every other form — an Array size, three or more sizes, a trailing format —
 * goes to the same factory, which returns the mathjs shape.
 */
export const zeros: TypedFunction = _factoryZeros as unknown as TypedFunction;

/**
 * Ones (mathjs-compatible).
 *
 * #1550: the mathjs-shaped factory, with the same forms as {@link zeros}.
 */
export const ones: TypedFunction = _factoryOnes as unknown as TypedFunction;

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
  dotMultiply: typeof _dotMultiply;
} = { ..._shims, dotMultiply: compatDotMultiply };
