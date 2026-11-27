/**
 * mathjs 15.3.0 reads fraction.js fields (`s`, `n`, `d`) in predicate kernels;
 * MathTS factories call core Fraction APIs (`isPositive()`, …). Shim the compat
 * surface so mathjs-tagged fraction.js instances follow mathjs rules (#1779 / G03).
 */
import type { TypedFunction } from '@danielsimonjr/mathts-core';
import { isMatrix } from '@danielsimonjr/mathts-core';
import { deepMap } from '@danielsimonjr/mathts-core/internal';
import {
  isMathjsFraction,
  mathjsFractionClass,
  type MathjsFraction,
} from './mathjs-fraction-class.js';

function isCollection(value: unknown): boolean {
  return Array.isArray(value) || isMatrix(value);
}

function bigintField(value: unknown): bigint {
  return typeof value === 'bigint' ? value : BigInt(value as number | string);
}

function mathjsFractionIsPositive(x: MathjsFraction): boolean {
  const s = bigintField(x.s);
  const n = bigintField(x.n);
  return s > 0n && n > 0n;
}

function mathjsFractionIsNegative(x: MathjsFraction): boolean {
  return bigintField(x.s) < 0n;
}

function mathjsFractionIsInteger(x: MathjsFraction): boolean {
  return bigintField(x.d) === 1n;
}

function mathjsFractionIsZero(x: MathjsFraction): boolean {
  return bigintField(x.n) === 0n;
}

const FRACTION_TO_BIGNUMBER_ERROR =
  'Cannot implicitly convert a Fraction to BigNumber or vice versa. Use function bignumber(x) to convert to BigNumber or fraction(x) to convert to Fraction.';

function mathjsFractionIsPrime(_x: MathjsFraction): never {
  throw new TypeError(FRACTION_TO_BIGNUMBER_ERROR);
}

function mathjsFractionFix(x: MathjsFraction): MathjsFraction {
  return (bigintField(x.s) < 0n ? x.ceil() : x.floor()) as MathjsFraction;
}

function copyTypedSurface(shim: object, typedFn: object): void {
  for (const key of Reflect.ownKeys(typedFn)) {
    if (key === 'prototype') continue;
    const desc = Object.getOwnPropertyDescriptor(typedFn, key);
    if (desc) Object.defineProperty(shim, key, desc);
  }
}

/** Unary typed shim: mathjs `Fraction` args use mathjs fraction.js predicates. */
export function wrapUnaryForMathjsFraction(
  fn: TypedFunction,
  onFraction: (x: MathjsFraction) => unknown
): TypedFunction {
  const shim = function (this: unknown, ...args: unknown[]): unknown {
    if (args.length >= 1 && isMathjsFraction(args[0])) {
      return onFraction(args[0]);
    }
    if (args.length >= 1 && isCollection(args[0])) {
      const rest = args.slice(1);
      return deepMap(args[0], (element: unknown) =>
        (shim as (...a: unknown[]) => unknown)(element, ...rest)
      );
    }
    return fn.apply(this, args);
  };
  copyTypedSurface(shim, fn);
  return shim as TypedFunction;
}

/** `fix` on fraction.js matches mathjs (`ceil` / `floor` from sign). */
export function wrapFixForMathjsFraction(fn: TypedFunction): TypedFunction {
  const shim = function (this: unknown, ...args: unknown[]): unknown {
    if (args.length >= 1 && isMathjsFraction(args[0])) {
      const x = args[0];
      if (args.length === 1) {
        return mathjsFractionFix(x);
      }
      const n = args[1];
      if (typeof n === 'number' && !Number.isInteger(n)) {
        throw new RangeError(
          `The number ${n} cannot be converted to a BigInt because it is not an integer`
        );
      }
      const places =
        typeof n === 'bigint' ? Number(n) : typeof n === 'number' ? n : Number(n as string);
      return x.round(places) as MathjsFraction;
    }
    if (args.length >= 2 && isCollection(args[0])) {
      return fn.apply(this, args);
    }
    if (args.length >= 1 && isCollection(args[0])) {
      const rest = args.slice(1);
      return deepMap(args[0], (element: unknown) =>
        (shim as (...a: unknown[]) => unknown)(element, ...rest)
      );
    }
    return fn.apply(this, args);
  };
  copyTypedSurface(shim, fn);
  return shim as TypedFunction;
}

export const compatFractionIsPositive = mathjsFractionIsPositive;
export const compatFractionIsNegative = mathjsFractionIsNegative;
export const compatFractionIsInteger = mathjsFractionIsInteger;
export const compatFractionIsZero = mathjsFractionIsZero;
export const compatFractionIsPrime = mathjsFractionIsPrime;

function mathjsFractionMul(a: unknown, b: unknown): unknown | null {
  if (isMathjsFraction(a) && (isMathjsFraction(b) || typeof b === 'number')) {
    return a.mul(b as number | MathjsFraction);
  }
  if (isMathjsFraction(b) && (isMathjsFraction(a) || typeof a === 'number')) {
    const left = isMathjsFraction(a) ? a : new mathjsFractionClass(a as number | string);
    return left.mul(b as number | MathjsFraction);
  }
  return null;
}

/** `multiplyScalar` / sparse dot paths use fraction.js `mul`, not core `multiply`. */
export function wrapMultiplyScalarForMathjsFraction(fn: TypedFunction): TypedFunction {
  const shim = function (this: unknown, ...args: unknown[]): unknown {
    if (args.length === 2) {
      const frac = mathjsFractionMul(args[0], args[1]);
      if (frac !== null) return frac;
    }
    return fn.apply(this, args);
  };
  copyTypedSurface(shim, fn);
  return shim as TypedFunction;
}
