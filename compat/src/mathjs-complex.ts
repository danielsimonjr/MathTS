/**
 * complex.js 2.4.3 Riemann-sphere arithmetic for the compat instance only (#1589).
 * Native `@danielsimonjr/mathts-core` `Complex` keeps IEEE semantics.
 */
import { Complex, isComplex, isBigNumber, isFraction } from '@danielsimonjr/mathts-core';

function riemannNonFinite(re: number, im: number): boolean {
  return !Number.isFinite(re) || !Number.isFinite(im);
}

function riemannZero(re: number, im: number): boolean {
  return re === 0 && im === 0;
}

function asComplex(value: unknown): Complex | null {
  if (isComplex(value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Complex(value, 0);
  if (isBigNumber(value)) return new Complex((value as { valueOf(): number }).valueOf(), 0);
  return null;
}

/** complex.js `add` for two Complex operands. */
function complexJsAdd(a: Complex, b: Complex): Complex {
  const tInf = riemannNonFinite(a.re, a.im);
  const zInf = riemannNonFinite(b.re, b.im);
  if (tInf || zInf) {
    if (tInf && zInf) return new Complex(NaN, NaN);
    return new Complex(Infinity, Infinity);
  }
  return new Complex(a.re + b.re, a.im + b.im);
}

/** complex.js `sub` for two Complex operands. */
function complexJsSubtract(a: Complex, b: Complex): Complex {
  const tInf = riemannNonFinite(a.re, a.im);
  const zInf = riemannNonFinite(b.re, b.im);
  if (tInf || zInf) {
    if (tInf && zInf) return new Complex(NaN, NaN);
    return new Complex(Infinity, Infinity);
  }
  return new Complex(a.re - b.re, a.im - b.im);
}

/** complex.js `mul` for two Complex operands. */
function complexJsMultiply(a: Complex, b: Complex): Complex {
  const tInf = riemannNonFinite(a.re, a.im);
  const zInf = riemannNonFinite(b.re, b.im);
  const tZero = riemannZero(a.re, a.im);
  const zZero = riemannZero(b.re, b.im);
  if ((tInf && zZero) || (zInf && tZero)) return new Complex(NaN, NaN);
  if (tInf || zInf) return new Complex(Infinity, Infinity);
  if (a.im === 0 && b.im === 0) return new Complex(a.re * b.re, 0);
  return new Complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}

/** complex.js `div` for two Complex operands. */
function complexJsDivide(a: Complex, b: Complex): Complex {
  const tInf = riemannNonFinite(a.re, a.im);
  const zInf = riemannNonFinite(b.re, b.im);
  const tZero = riemannZero(a.re, a.im);
  const zZero = riemannZero(b.re, b.im);
  if ((tZero && zZero) || (tInf && zInf)) return new Complex(NaN, NaN);
  if (zZero || tInf) return new Complex(Infinity, Infinity);
  if (tZero || zInf) return new Complex(0, 0);
  return a.divide(b);
}

/**
 * Route Complex-bearing binary calls through complex.js; otherwise delegate to the native typed fn.
 */
export function withMathjsComplexBinary(
  native: (a: unknown, b: unknown) => unknown,
  op: 'add' | 'sub' | 'mul' | 'div'
): (a: unknown, b: unknown) => unknown {
  const combine = {
    add: complexJsAdd,
    sub: complexJsSubtract,
    mul: complexJsMultiply,
    div: complexJsDivide,
  }[op];
  return (a: unknown, b: unknown) => {
    const ca = asComplex(a);
    const cb = asComplex(b);
    if (ca !== null && cb !== null) return combine(ca, cb);
    return native(a, b);
  };
}

/**
 * mathjs `zpk2tf` rejects BigNumber/Fraction gain (typed `number` only). Wrap so the
 * TypeError text matches the oracle without changing native `functions` signatures.
 */
export function wrapZpk2tfGainTypes<T>(zpk2tf: T): T {
  const impl = zpk2tf as (...a: unknown[]) => unknown;
  const wrapped = function (this: unknown, ...args: unknown[]): unknown {
    if (args.length >= 3 && (isBigNumber(args[2]) || isFraction(args[2]))) {
      const actual = isBigNumber(args[2]) ? 'BigNumber' : 'Fraction';
      throw new TypeError(
        `Unexpected type of argument in function zpk2tf (expected: number or bigint or string or boolean, actual: ${actual}, index: 2)`
      );
    }
    return impl.apply(this, args);
  };
  for (const key of Reflect.ownKeys(zpk2tf as object)) {
    if (key === 'prototype') continue;
    const desc = Object.getOwnPropertyDescriptor(zpk2tf as object, key);
    if (desc) Object.defineProperty(wrapped, key, desc);
  }
  return wrapped as T;
}
