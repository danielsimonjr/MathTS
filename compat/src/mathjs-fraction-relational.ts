/**
 * mathjs 15.3.0 relational kernels use fraction.js `equals` / `compare`, not core `Fraction`.
 */
import type { TypedFunction } from '@danielsimonjr/mathts-core';
import { isMathjsFraction, mathjsFractionClass } from './mathjs-fraction-class.js';

function copyTypedSurface(shim: object, typedFn: object): void {
  for (const key of Reflect.ownKeys(typedFn)) {
    if (key === 'prototype') continue;
    const desc = Object.getOwnPropertyDescriptor(typedFn, key);
    if (desc) Object.defineProperty(shim, key, desc);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function tryMathjsFractionEquals(a: unknown, b: unknown): boolean | null {
  const left = isMathjsFraction(a) ? a : null;
  const right = isMathjsFraction(b) ? b : null;
  if (left === null && right === null) return null;
  if (left !== null && right !== null) return left.equals(right);
  if (left !== null && isFiniteNumber(b)) {
    return left.equals(new mathjsFractionClass(b));
  }
  if (right !== null && isFiniteNumber(a)) {
    return right.equals(new mathjsFractionClass(a));
  }
  return null;
}

/** Negated {@link tryMathjsFractionEquals} when either operand is a mathjs Fraction. */
export function wrapUnequalForMathjsFraction(fn: TypedFunction): TypedFunction {
  const shim = function (this: unknown, ...args: unknown[]): unknown {
    if (args.length === 2) {
      const fractionResult = tryMathjsFractionEquals(args[0], args[1]);
      if (fractionResult !== null) return !fractionResult;
    }
    return fn.apply(this, args);
  };
  copyTypedSurface(shim, fn);
  return shim as TypedFunction;
}

/** Route scalar equality through fraction.js when either operand is a mathjs Fraction. */
export function wrapEqualForMathjsFraction(fn: TypedFunction): TypedFunction {
  const shim = function (this: unknown, ...args: unknown[]): unknown {
    if (args.length === 2) {
      const fractionResult = tryMathjsFractionEquals(args[0], args[1]);
      if (fractionResult !== null) return fractionResult;
    }
    return fn.apply(this, args);
  };
  copyTypedSurface(shim, fn);
  return shim as TypedFunction;
}
