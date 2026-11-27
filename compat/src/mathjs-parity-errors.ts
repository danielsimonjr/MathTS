/**
 * Remap MathTS typed / factory errors to mathjs 15.3.0 message and class shapes (#1773).
 */

import {
  BigNumber as CompatBigNumber,
  compatDecimalResult,
  getCompatDecimalBigNumberCtor,
} from './bignumber.js';

function compatDecimalNaN(): CompatBigNumber {
  return new (getCompatDecimalBigNumberCtor() as typeof CompatBigNumber)(NaN);
}
import {
  FRACTION_TO_BIGNUMBER_ERROR,
  invalidNumericStringError,
  isBigNumberLike,
  isMatrixLikeValue,
  isOwnBigNumber,
  tooManyArgumentsError,
} from './mathjs-parity-g02.js';
import { isBigNumber, isFraction, type BigNumber } from '@danielsimonjr/mathts-core';

const MATHTS_SCALAR_GUARD = /^(\w+): unexpected type (.+) at index (\d+)$/;

const BIGNUMBER_PARSE = /Cannot parse|BigNumber cannot parse/i;

function isRangeLike(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as { isRange?: boolean } | null;
  return proto?.isRange === true;
}

function isMapCallbackInvocation(args: unknown[]): boolean {
  if (args.length !== 3) return false;
  const indexPath = args[1];
  const container = args[2];
  if (!(Array.isArray(container) || isMatrixLikeValue(container))) return false;
  // MathTS `deepMap` passes `(value, indexPath, source)`; mathjs passes `(value, i, array)`.
  if (typeof indexPath === 'number' && Number.isInteger(indexPath)) return true;
  return (
    Array.isArray(indexPath) &&
    indexPath.length > 0 &&
    indexPath.every((x) => typeof x === 'number')
  );
}

function matrixMapHintError(name: string): TypeError {
  return new TypeError(
    `Function '${name}' doesn't apply to matrices. To call it ` +
      `elementwise on a matrix 'M', try 'map(M, ${name})'.`
  );
}

function isUnitLike(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return (
    (value as { constructor?: { prototype?: { isUnit?: boolean } } }).constructor?.prototype
      ?.isUnit === true
  );
}

function formatMathjsActual(typeLabel: string): string {
  if (typeLabel === 'null') return 'identifier | null';
  if (typeLabel === 'undefined') return 'identifier | undefined';
  return typeLabel;
}

/** Rewrite `… in function addScalar` → `… in function add` on the public compat surface. */
export function remapPublicScalarFnName(
  message: string,
  factoryName: string,
  publicName: string
): string {
  return message.replaceAll(`function ${factoryName}`, `function ${publicName}`);
}

/**
 * Wrap a mathjs factory scalar (e.g. `addScalar`) for the public `add` name:
 * rewrite error messages, remap conversion failures, and guard Fraction×BigNumber.
 */
export function withPublicFactoryScalar(
  publicName: string,
  factoryName: string,
  factoryFn: (...args: unknown[]) => unknown,
  options?: { guardFractionBigNumber?: boolean }
): (...args: unknown[]) => unknown {
  const guarded = (...args: unknown[]): unknown => {
    if (options?.guardFractionBigNumber && args.length >= 2) {
      const [a, b] = args;
      const aIsBn =
        isBigNumber(a) || (typeof a === 'object' && a !== null && (a as BigNumber).isBigNumber);
      const bIsBn =
        isBigNumber(b) || (typeof b === 'object' && b !== null && (b as BigNumber).isBigNumber);
      if ((isFraction(a) && bIsBn) || (aIsBn && isFraction(b))) {
        throw new TypeError(FRACTION_TO_BIGNUMBER_ERROR);
      }
    }
    try {
      return factoryFn(...args);
    } catch (err) {
      const stringArg =
        typeof args[0] === 'string' ? args[0] : typeof args[1] === 'string' ? args[1] : undefined;
      const otherIsFraction = isFraction(args[0]) || isFraction(args[1]);
      if (
        stringArg !== undefined &&
        otherIsFraction &&
        err instanceof SyntaxError &&
        err.message.includes('BigInt')
      ) {
        throw new Error(`Cannot convert ${JSON.stringify(stringArg)} to Fraction`);
      }
      if (
        stringArg !== undefined &&
        err instanceof SyntaxError &&
        BIGNUMBER_PARSE.test(String(err))
      ) {
        throw new Error(`Cannot convert ${JSON.stringify(stringArg)} to BigNumber`);
      }
      if (stringArg !== undefined && err instanceof Error) {
        if (err.message.includes('Fraction') && err.message.includes('Cannot parse')) {
          throw new Error(`Cannot convert ${JSON.stringify(stringArg)} to Fraction`);
        }
        if (err.message.includes('Complex') && err.message.includes('Cannot parse')) {
          throw new Error(`Cannot convert ${JSON.stringify(stringArg)} to Complex`);
        }
      }
      if (err instanceof TypeError) {
        const guard = MATHTS_SCALAR_GUARD.exec(err.message);
        if (guard) {
          const typeLabel = formatMathjsActual(guard[2] ?? '');
          const expectedTypes =
            factoryName === 'addScalar'
              ? 'number or Complex or BigNumber or bigint or Fraction or Unit or string or boolean'
              : 'any';
          throw new TypeError(
            `Unexpected type of argument in function ${factoryName} ` +
              `(expected: ${expectedTypes}, actual: ${typeLabel}, index: ${guard[3]})`
          );
        }
        if (err.message.includes(`function ${factoryName}`)) {
          const remapped = remapPublicScalarFnName(err.message, factoryName, publicName).replace(
            'actual: null,',
            'actual: identifier | null,'
          );
          throw new TypeError(remapped);
        }
      }
      if (
        err instanceof TypeError &&
        publicName === 'add' &&
        isUnitLike(args[0]) &&
        args[1] !== undefined &&
        !isUnitLike(args[1])
      ) {
        const actualType = args[1] === null ? 'identifier | null' : typeof args[1];
        throw new TypeError(
          `Unexpected type of argument in function ${factoryName} (expected: Unit, actual: ${actualType}, index: 1)`
        );
      }
      throw err;
    }
  };
  try {
    Object.defineProperty(guarded, 'name', { value: publicName, configurable: true });
  } catch {
    // ignore
  }
  return guarded;
}

/** Turn a unary typed "matrix not supported" error into mathjs's map(M, fn) hint. */
export function withMatrixMapHintOnUnary(
  name: string,
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    const callArgs = isMapCallbackInvocation(args) ? [args[0]] : args;
    if (callArgs.length === 1) {
      const x = callArgs[0];
      if (Array.isArray(x) || isMatrixLikeValue(x) || isRangeLike(x)) {
        throw matrixMapHintError(name);
      }
    }
    try {
      return fn(...callArgs);
    } catch (err) {
      if (!(err instanceof TypeError) || callArgs.length !== 1) throw err;
      const msg = err.message;
      if (
        msg.includes('Unexpected type of argument') &&
        (msg.includes('Matrix') || msg.includes('Array'))
      ) {
        throw matrixMapHintError(name);
      }
      throw err;
    }
  };
}

type BitwiseBinaryOp = 'and' | 'or' | 'xor';

/** mathjs bitwise binary ops on infinite BigNumbers (#1097). */
export function withCompatBitwiseInfiniteBigNumberBinary(
  fn: (a: unknown, b: unknown) => unknown,
  op: BitwiseBinaryOp
): (a: unknown, b: unknown) => unknown {
  const asBigNumber = (x: unknown): BigNumber | null => {
    if (isBigNumber(x)) return x;
    if (typeof x === 'object' && x !== null && (x as BigNumber).isBigNumber === true) {
      return x as BigNumber;
    }
    return null;
  };
  return (a: unknown, b: unknown): unknown => {
    const aa = asBigNumber(a);
    const bb = asBigNumber(b);
    const wrap = (out: unknown) => compatDecimalResult(out);
    if (!aa || !bb) return wrap(fn(a, b));
    const aInf = !aa.isFinite();
    const bInf = !bb.isFinite();
    if (!aInf && !bInf) return wrap(fn(a, b));
    const finite = aInf ? bb : aa;
    const infinite = aInf ? aa : bb;
    if (op === 'and') return wrap(finite);
    if (op === 'or') return wrap(infinite);
    if (op === 'xor') {
      if (finite.eq(-1)) return wrap(infinite.neg());
      return wrap(infinite);
    }
    return wrap(fn(a, b));
  };
}

/** mathjs keeps infinite BigNumber operands under bitwise `bitNot` (#1097). */
export function withCompatBitNotInfiniteBigNumber(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (x: unknown): unknown => {
    if (
      isBigNumber(x) ||
      (typeof x === 'object' && x !== null && (x as BigNumber).isBigNumber === true)
    ) {
      const bn = x as BigNumber;
      if (!bn.isFinite()) {
        return bn.neg();
      }
    }
    return compatDecimalResult(fn(x));
  };
}

function asCompatBigNumber(x: unknown): BigNumber | null {
  if (isBigNumber(x)) return x;
  if (typeof x === 'object' && x !== null && (x as BigNumber).isBigNumber === true) {
    return x as BigNumber;
  }
  return null;
}

/**
 * mathjs bitwise shifts on BigNumbers: negative shift → NaN; infinite patterns (#1780).
 */
function negativeShiftNaN(shift: unknown): boolean {
  if (typeof shift === 'number') {
    return Number.isFinite(shift) && shift < 0;
  }
  const shiftBn = asCompatBigNumber(shift);
  return Boolean(shiftBn && shiftBn.isFinite() && shiftBn.lt(0));
}

export function withCompatBitShiftBigNumberParity(
  fn: (a: unknown, b: unknown) => unknown
): (a: unknown, b: unknown) => unknown {
  return (a: unknown, b: unknown): unknown => {
    if (negativeShiftNaN(b)) {
      return compatDecimalResult(compatDecimalNaN());
    }
    const base = asCompatBigNumber(a);
    const shift = asCompatBigNumber(b);
    const shiftIsNumber = typeof b === 'number';
    const Ctor = getCompatDecimalBigNumberCtor() as typeof CompatBigNumber;
    const shiftPositiveInfinity =
      b === Infinity ||
      (shiftIsNumber && b === Number.POSITIVE_INFINITY) ||
      Boolean(shift && shift.isPositive() && !shift.isFinite());
    const basePositiveInfinity =
      a === Infinity ||
      a === Number.POSITIVE_INFINITY ||
      Boolean(base && base.isPositive() && !base.isFinite());
    const baseNegativeInfinity =
      a === -Infinity ||
      a === Number.NEGATIVE_INFINITY ||
      Boolean(base && base.isNegative() && !base.isFinite());
    if (basePositiveInfinity && shiftPositiveInfinity) {
      return compatDecimalResult(compatDecimalNaN());
    }
    if (baseNegativeInfinity && shiftPositiveInfinity) {
      return compatDecimalResult(new Ctor(-1));
    }
    if (base) {
      if (shift) {
        if (!base.isFinite()) {
          if (!shift.isFinite()) {
            if (base.isNegative() && shift.isPositive()) {
              return compatDecimalResult(new (getCompatDecimalBigNumberCtor() as typeof CompatBigNumber)(-1));
            }
            return compatDecimalResult(compatDecimalNaN());
          }
          return compatDecimalResult(base);
        }
      } else if (shiftIsNumber && !Number.isFinite(b)) {
        if (!base.isFinite()) {
          if (base.isNegative() && (b as number) > 0) {
            return compatDecimalResult(new (getCompatDecimalBigNumberCtor() as typeof CompatBigNumber)(-1));
          }
          return compatDecimalResult(compatDecimalNaN());
        }
        return compatDecimalResult(base);
      }
    }
    try {
      return compatDecimalResult(fn(a, b));
    } catch (err) {
      if (base && !base.isFinite() && (shift?.isFinite() || (shiftIsNumber && Number.isFinite(b)))) {
        return compatDecimalResult(base);
      }
      if (base && negativeShiftNaN(b)) {
        return compatDecimalResult(compatDecimalNaN());
      }
      throw err;
    }
  };
}

/** mathjs `bitNot` uses singular `Integer expected`; other bitwise ops use `Integers`. */
export function withBitNotIntegerMessage(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    try {
      return fn(...args);
    } catch (err) {
      if (err instanceof Error && err.message === 'Integers expected in function bitNot') {
        throw new Error('Integer expected in function bitNot');
      }
      throw err;
    }
  };
}

/** Spectral matrix norm (p=2) requires a square matrix in mathjs 15.3.0. */
export function withMathjsNormMatrixRules(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (args.length >= 2) {
      const x = args[0];
      const p = args[1];
      if (
        p === 2 &&
        Array.isArray(x) &&
        x.length > 0 &&
        x.every((row) => Array.isArray(row)) &&
        x[0]!.length > 0
      ) {
        const rows = x.length;
        const cols = (x[0] as unknown[]).length;
        const uniform = x.every((row) => Array.isArray(row) && row.length === cols);
        if (uniform && rows !== cols) {
          throw new RangeError('Invalid matrix dimensions');
        }
      }
    }
    return fn(...args);
  };
}

/** Reject invalid numeric strings that would become NaN under mathjs `numeric()`. */
export function createCompatNumeric(
  native: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    const outputType = args.length < 2 ? 'number' : args[1];
    const out = native(...args);
    if (
      typeof args[0] === 'string' &&
      (outputType === 'number' || outputType === undefined) &&
      typeof out === 'number' &&
      Number.isNaN(out) &&
      (args[0].trim() === '' || Number.isNaN(Number(args[0])))
    ) {
      throw invalidNumericStringError(args[0]);
    }
    return compatDecimalResult(out);
  };
}

/**
 * Instance `random` from `instanceSymbols` is a typed-function; arity/BigNumber guards
 * must live on a plain forwarder (no copied signatures), or dispatch skips them (#1773).
 */
export function createCompatRandomInstance(
  typedRandom: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  function random(this: unknown, ...args: unknown[]): unknown {
    const maxArgs = Array.isArray(args[0]) || isMatrixLikeValue(args[0]) ? 3 : 2;
    if (args.length > maxArgs) {
      throw tooManyArgumentsError('random', maxArgs, args.length);
    }
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (isBigNumber(arg) || isOwnBigNumber(arg) || isBigNumberLike(arg)) {
        throw new TypeError(
          `Unexpected type of argument in function random (expected: number or Array or Matrix or bigint or string or boolean, actual: BigNumber, index: ${i})`
        );
      }
    }
    return typedRandom.apply(this, args);
  }
  try {
    Object.defineProperty(random, 'name', { value: 'random', configurable: true });
  } catch {
    // ignore
  }
  return random;
}
