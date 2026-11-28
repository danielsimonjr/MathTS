/**
 * mathjs 15.3.0 arithmetic / dispatch parity (#1787).
 * Instance wrappers and scalar routing that mirror mathjs typed conversions on the compat surface.
 */

import {
  FRACTION_TO_BIGNUMBER_ERROR,
  isBigNumberLike,
  isComplexLike,
  isFractionLike,
  isOwnBigNumber,
  keepSurface,
} from './mathjs-parity-g02.js';
import { isUnit } from '@danielsimonjr/mathts-core';

type BinaryFactory = (...args: unknown[]) => unknown;

/** True for compat / core unit instances (used to keep factory scalar paths). */
export function isUnitOperand(x: unknown): boolean {
  if (isUnit(x)) return true;
  return typeof x === 'object' && x !== null && (x as { isUnit?: boolean }).isUnit === true;
}

type UnaryLike = (...args: never[]) => unknown;

/** Promote booleans to bigint when any operand is a bigint (mathjs lowest-index conversion). */
export function promoteBooleanForBigIntOperands(args: unknown[]): unknown[] {
  if (!args.some((a) => typeof a === 'bigint')) return args;
  return args.map((a) => (typeof a === 'boolean' ? BigInt(a ? 1 : 0) : a));
}

/** True when a plain number would lose precision converting into a Fraction operand. */
export function isLossyNumberToFraction(n: number): boolean {
  if (!Number.isFinite(n) || Number.isInteger(n)) return false;
  // mathjs rejects irrationals and non-exact binary fractions when the other side is already Fraction.
  const rounded = Math.round(n);
  return rounded !== n || Math.abs(n - rounded) > Number.EPSILON;
}

/**
 * When one operand is a Fraction, avoid widening a non-exact number through fraction.js.
 * Returns `null` when the pair should use the factory scalar path instead.
 */
export function shouldUseFactoryScalarForFractionPair(a: unknown, b: unknown): boolean {
  const aFrac = isFractionLike(a);
  const bFrac = isFractionLike(b);
  if (!aFrac && !bFrac) return false;
  if (typeof a === 'number' && bFrac && isLossyNumberToFraction(a)) return true;
  if (typeof b === 'number' && aFrac && isLossyNumberToFraction(b)) return true;
  if (typeof a === 'bigint' || typeof b === 'bigint') return true;
  return false;
}

/** Operand value that decimal.js accepts (number, string, or another Decimal). */
function decimalJsOtherOperand(value: unknown): string | number | unknown {
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint') {
    return typeof value === 'bigint' ? value.toString() : value;
  }
  if (isOwnBigNumber(value)) {
    return (value as { toString(): string }).toString();
  }
  if (isBigNumberLike(value)) {
    return value;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    (value as { isBigNumber?: boolean }).isBigNumber === true
  ) {
    return (value as { toString(): string }).toString();
  }
  return value;
}

/** Run decimal.js arithmetic when either operand is a foreign `Decimal` instance. */
export function tryDecimalJsBinary(
  op: 'add' | 'sub' | 'mul' | 'div',
  a: unknown,
  b: unknown
): unknown | null {
  const aDec = isBigNumberLike(a);
  const bDec = isBigNumberLike(b);
  if (!aDec && !bDec) return null;
  const methods = { add: 'plus', sub: 'minus', mul: 'times', div: 'dividedBy' } as const;
  const name = methods[op];
  const left = a as { [key: string]: (x: unknown) => unknown };
  if (aDec && bDec) return left[name](b);
  if (aDec) return left[name](decimalJsOtherOperand(b));
  if (bDec) {
    const DecimalCtor = (b as { constructor: new (x: unknown) => unknown }).constructor;
    const promLeft = new DecimalCtor(decimalJsOtherOperand(a)) as {
      [key: string]: (x: unknown) => unknown;
    };
    return promLeft[name](b);
  }
  return null;
}

/**
 * mathjs factory `addScalar` / `subtractScalar` entry: Decimal.js, bigint×Fraction,
 * and boolean promotion beside BigNumber.
 */
export function createFactoryScalar1787Wrapper(
  op: 'add' | 'sub',
  factoryFn: BinaryFactory,
  bigintFractionPair: (
    pairOp: 'add' | 'sub' | 'mul' | 'div',
    a: unknown,
    b: unknown
  ) => unknown | null,
  promoteBooleans: (args: unknown[]) => unknown[],
  fractionPair?: (a: unknown, b: unknown) => unknown | null
): BinaryFactory {
  const decimalOp = op;
  return (...args: unknown[]): unknown => {
    if (args.length === 2) {
      const decimal = tryDecimalJsBinary(decimalOp, args[0], args[1]);
      if (decimal !== null) return decimal;
      const bigFrac = bigintFractionPair(decimalOp, args[0], args[1]);
      if (bigFrac !== null) return bigFrac;
      if (fractionPair !== undefined) {
        const frac = fractionPair(args[0], args[1]);
        if (frac !== null) return frac;
      }
    }
    return factoryFn(...promoteBooleans(args));
  };
}

/** mathjs stacks row-shaped matrices from an array and matrix-multiplies the stacks. */
export function multiplyMatrixRowLists(
  matrixFn: (nested: unknown) => unknown,
  matMul: (a: unknown, b: unknown) => unknown,
  a: unknown,
  b: unknown
): unknown | null {
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  if (!arrayContainsMatrix(a) || !arrayContainsMatrix(b)) return null;
  if (a.length === 0 || b.length === 0) return null;
  const rowVectors = (entries: unknown[]): unknown[][] | null => {
    const rows: unknown[][] = [];
    for (const entry of entries) {
      if (typeof entry !== 'object' || entry === null || !('toArray' in entry)) return null;
      const row = (entry as { toArray(): unknown }).toArray();
      if (!Array.isArray(row)) return null;
      rows.push(row as unknown[]);
    }
    return rows;
  };
  const left = rowVectors(a);
  const right = rowVectors(b);
  if (left === null || right === null) return null;
  return matMul(matrixFn(left), matrixFn(right));
}

/** `zeta` passes Complex loop indices into `factorial`; mathjs factorial accepts their real part. */
export function createZetaFactorial(
  factorial: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (value: unknown) => {
    if (isComplexLike(value)) {
      const im = (value as { im: unknown }).im;
      if (typeof im === 'number' && im === 0) {
        return factorial((value as { re: unknown }).re);
      }
    }
    return factorial(value);
  };
}

/** Prep arguments before factory `addScalar` / `multiplyScalar` / `subtractScalar`. */
export function prepareFactoryScalarOperands(args: unknown[]): unknown[] {
  return promoteBooleanForBigIntOperands(args);
}

/** `log` rejects unary Fraction args but allows two-arg `log(x, base)` on Fractions. */
export function withFractionLogParity(fn: UnaryLike): (...args: unknown[]) => unknown {
  return keepSurface(fn, (...args: unknown[]): unknown => {
    if (args.length === 1) {
      for (const arg of args) {
        if (isFractionLike(arg)) throw new TypeError(FRACTION_TO_BIGNUMBER_ERROR);
      }
    }
    try {
      return (fn as (...callArgs: unknown[]) => unknown)(...args);
    } catch (err) {
      if (
        args.length === 2 &&
        (isFractionLike(args[0]) || isFractionLike(args[1])) &&
        err instanceof TypeError &&
        err.message.includes('toNumber')
      ) {
        throw new TypeError(FRACTION_TO_BIGNUMBER_ERROR);
      }
      throw err;
    }
  });
}

function isOneDimensionalNormInput(x: unknown): boolean {
  if (Array.isArray(x)) {
    return x.length === 0 || !Array.isArray(x[0]);
  }
  if (typeof x === 'object' && x !== null && 'size' in x) {
    const raw = (x as { size: () => unknown }).size();
    let dims: unknown = raw;
    if (Array.isArray(raw) && typeof (raw as { valueOf?: () => unknown }).valueOf === 'function') {
      dims = (raw as { valueOf: () => unknown }).valueOf();
    }
    return Array.isArray(dims) && dims.length === 1;
  }
  return false;
}

/** Vector `norm` with `p === 0` is `+Infinity` on finite vectors in mathjs 15.3.0. */
export function withMathjsNormZeroInfinity(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (args.length >= 2) {
      const p = args[1];
      if (isOneDimensionalNormInput(args[0]) && (p === 0 || Object.is(p, 0))) {
        return Number.POSITIVE_INFINITY;
      }
    }
    return fn(...args);
  };
}

function componentNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (isComplexLike(value)) return (value as { re: number }).re;
  if (typeof value === 'object' && value !== null && 're' in value) {
    const re = (value as { re: unknown }).re;
    if (typeof re === 'number') return re;
  }
  return Number(value);
}

/** Relational compare used inside the mathjs 15.3.0 `zeta` kernel (Complex loop index). */
export function createZetaSmallerEq(
  smallerEq: (a: unknown, b: unknown) => boolean
): (a: unknown, b: unknown) => boolean {
  return (a, b) => {
    if (isComplexLike(a) || isComplexLike(b)) {
      const ar = componentNumber(a);
      const br = componentNumber(b);
      if (ar !== br) return ar < br;
      const ai =
        isComplexLike(a) && typeof (a as { im: unknown }).im === 'number'
          ? (a as { im: number }).im
          : 0;
      const bi =
        isComplexLike(b) && typeof (b as { im: unknown }).im === 'number'
          ? (b as { im: number }).im
          : 0;
      return ai <= bi;
    }
    return smallerEq(a, b);
  };
}

/** True when a nested array holds matrix instances (mathjs `multiply` on collections of matrices). */
export function arrayContainsMatrix(x: unknown): boolean {
  if (!Array.isArray(x)) return false;
  for (const entry of x) {
    if (
      entry !== null &&
      typeof entry === 'object' &&
      (Object.getPrototypeOf(entry) as { isMatrix?: boolean } | null)?.isMatrix === true
    ) {
      return true;
    }
    if (Array.isArray(entry) && arrayContainsMatrix(entry)) return true;
  }
  return false;
}

/** Route scalar multiply through the factory when a unit is involved (fraction.js value typing). */
export function shouldUseFactoryScalarForMultiply(a: unknown, b: unknown): boolean {
  if (isUnitOperand(a) || isUnitOperand(b)) return true;
  if (shouldUseFactoryScalarForFractionPair(a, b)) return true;
  return false;
}

/** Detect decimal.js (`Decimal`) operands for promotion on the instance binary wrappers. */
export function operandsUseDecimalJs(args: unknown[]): boolean {
  return args.some(isBigNumberLike);
}
