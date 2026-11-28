/**
 * complex.js 2.4.3 Riemann-sphere arithmetic for the compat instance only (#1589).
 * Native `@danielsimonjr/mathts-core` `Complex` keeps IEEE semantics.
 */
import { Complex, isComplex, isBigNumber, isFraction } from '@danielsimonjr/mathts-core';

function riemannNonFinite(re: unknown, im: unknown): boolean {
  const a = complexComponentNumber(re);
  const b = complexComponentNumber(im);
  return !Number.isFinite(a) || !Number.isFinite(b);
}

function riemannZero(re: unknown, im: unknown): boolean {
  return complexComponentNumber(re) === 0 && complexComponentNumber(im) === 0;
}

function bigNumberToNumber(value: { toNumber?: () => number; valueOf(): unknown }): number {
  if (typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  const primitive = value.valueOf();
  return typeof primitive === 'number' ? primitive : Number(primitive);
}

function complexComponentNumber(re: number | unknown): number {
  return isBigNumber(re)
    ? bigNumberToNumber(re as { toNumber?: () => number; valueOf(): unknown })
    : (re as number);
}

function asComplex(value: unknown): Complex | null {
  if (isComplex(value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Complex(value, 0);
  if (isBigNumber(value))
    return new Complex(
      bigNumberToNumber(value as { toNumber?: () => number; valueOf(): unknown }),
      0
    );
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
  return new Complex(
    complexComponentNumber(a.re) + complexComponentNumber(b.re),
    complexComponentNumber(a.im) + complexComponentNumber(b.im)
  );
}

/** complex.js `sub` for two Complex operands. */
function complexJsSubtract(a: Complex, b: Complex): Complex {
  const tInf = riemannNonFinite(a.re, a.im);
  const zInf = riemannNonFinite(b.re, b.im);
  if (tInf || zInf) {
    if (tInf && zInf) return new Complex(NaN, NaN);
    return new Complex(Infinity, Infinity);
  }
  return new Complex(
    complexComponentNumber(a.re) - complexComponentNumber(b.re),
    complexComponentNumber(a.im) - complexComponentNumber(b.im)
  );
}

/** complex.js `mul` for two Complex operands. */
function complexJsMultiply(a: Complex, b: Complex): Complex {
  const tInf = riemannNonFinite(a.re, a.im);
  const zInf = riemannNonFinite(b.re, b.im);
  const tZero = riemannZero(a.re, a.im);
  const zZero = riemannZero(b.re, b.im);
  if ((tInf && zZero) || (zInf && tZero)) return new Complex(NaN, NaN);
  if (tInf || zInf) return new Complex(Infinity, Infinity);
  const ar = complexComponentNumber(a.re);
  const ai = complexComponentNumber(a.im);
  const br = complexComponentNumber(b.re);
  const bi = complexComponentNumber(b.im);
  if (ai === 0 && bi === 0) return new Complex(ar * br, 0);
  return new Complex(ar * br - ai * bi, ar * bi + ai * br);
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
  // complex.js divides each component by a real divisor; the general formula rounds
  // differently in the last digit (#1784: `(300 + 400i) kPa` to `lbf / in^2`).
  const br = complexComponentNumber(b.re);
  const bi = complexComponentNumber(b.im);
  if (bi === 0) {
    return new Complex(complexComponentNumber(a.re) / br, complexComponentNumber(a.im) / br);
  }
  // complex.js `div` (used by mathjs 15.3.0) — stable denominator scaling (#1787).
  const ar = complexComponentNumber(a.re);
  const ai = complexComponentNumber(a.im);
  if (Math.abs(br) < Math.abs(bi)) {
    const x = br / bi;
    const t = br * x + bi;
    return new Complex((ar * x + ai) / t, (ai * x - ar) / t);
  }
  const x = bi / br;
  const t = bi * x + br;
  return new Complex((ar + ai * x) / t, (ai - ar * x) / t);
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
    // Only Riemann-sphere when at least one operand is Complex. Number/BigNumber
    // pairs must stay on native typed add/mul/div (otherwise `0.1 + 0.2` under
    // number:'BigNumber' becomes Complex and the full-surface sweep fails).
    if (!isComplex(a) && !isComplex(b)) return native(a, b);
    const aInf = typeof a === 'number' && !Number.isFinite(a);
    const bInf = typeof b === 'number' && !Number.isFinite(b);
    if (op === 'mul' && (aInf || bInf) && (isComplex(a) || isComplex(b))) {
      return new Complex(Infinity, Infinity);
    }
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
