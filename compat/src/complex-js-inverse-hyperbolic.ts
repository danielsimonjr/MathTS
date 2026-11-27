/**
 * complex.js 2.4.2 inverse hyperbolic / arc (G08) for mathjs 15.3.0 compat only.
 * Uses core `Complex` arithmetic; does not call core `Complex.asinh` / `acosh` / `atanh`.
 */

import { Complex, isBigNumber, isComplex } from '@danielsimonjr/mathts-core';
import { compatDecimalResult } from './bignumber.js';

function logHypotComplexJs(a: number, b: number): number {
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  if (a === 0) return Math.log(absB);
  if (b === 0) return Math.log(absA);
  if (absA < 3000 && absB < 3000) {
    return Math.log(a * a + b * b) * 0.5;
  }
  const halfA = a * 0.5;
  const halfB = b * 0.5;
  return 0.5 * Math.log(halfA * halfA + halfB * halfB) + Math.LN2;
}

/** complex.js `hypot` (used only in the ported `sqrt`). */
function hypotComplexJs(a: number, b: number): number {
  let ax = Math.abs(a);
  let ay = Math.abs(b);
  if (ax < ay) [ax, ay] = [ay, ax];
  if (ax < 1e8) return Math.sqrt(ax * ax + ay * ay);
  ay /= ax;
  return ax * Math.sqrt(1 + ay * ay);
}

/** complex.js 2.4.2 `sqrt` — must not use core `Complex.sqrt` (different branch sheet). */
function complexJsSqrt(re: number, im: number): { re: number; im: number } {
  const a = re;
  const b = im;
  if (b === 0) {
    if (a >= 0) return { re: Math.sqrt(a), im: 0 };
    return { re: 0, im: Math.sqrt(-a) };
  }
  const r = hypotComplexJs(a, b);
  let sqrtRe = Math.sqrt(0.5 * (r + Math.abs(a)));
  const sqrtIm = Math.abs(b) / (2 * sqrtRe);
  if (a >= 0) {
    return { re: sqrtRe, im: b < 0 ? -sqrtIm : sqrtIm };
  }
  return { re: sqrtIm, im: b < 0 ? -sqrtRe : sqrtRe };
}

function complexJsLog(re: number, im: number): { re: number; im: number } {
  if (im === 0 && re > 0) {
    return { re: Math.log(re), im: 0 };
  }
  return { re: logHypotComplexJs(re, im), im: Math.atan2(im, re) };
}

function complexJsAsin(a: number, b: number): Complex {
  const t1 = complexJsSqrt(b * b - a * a + 1, -2 * a * b);
  const t2 = complexJsLog(t1.re - b, t1.im + a);
  return new Complex(t2.im, -t2.re);
}

function complexJsAcos(a: number, b: number): Complex {
  const t1 = complexJsSqrt(b * b - a * a + 1, -2 * a * b);
  const t2 = complexJsLog(t1.re - b, t1.im + a);
  return new Complex(Math.PI / 2 - t2.im, t2.re);
}

/** complex.js 2.4.2 `asinh` on a core `Complex` argument (compat oracle only). */
export function complexJsAsinh(z: Complex): Complex {
  const res = complexJsAsin(z.im, -z.re);
  return new Complex(-res.im, res.re);
}

/** complex.js 2.4.2 `acosh` (compat oracle only). */
export function complexJsAcosh(z: Complex): Complex {
  const res = complexJsAcos(z.re, z.im);
  if (res.im <= 0) {
    return new Complex(-res.im, res.re);
  }
  return new Complex(res.im, -res.re);
}

/** complex.js 2.4.2 `atanh` including overflow `logHypot` (compat oracle only). */
export function complexJsAtanh(z: Complex): Complex {
  const a = z.re;
  const b = z.im;
  const noIM = a > 1 && b === 0;
  const oneMinus = 1 - a;
  const onePlus = 1 + a;
  const d = oneMinus * oneMinus + b * b;
  const x =
    d !== 0
      ? new Complex((onePlus * oneMinus - b * b) / d, (b * oneMinus + onePlus * b) / d)
      : new Complex(a !== -1 ? a / 0 : 0, b !== 0 ? b / 0 : 0);
  const temp = x.re;
  const re = logHypotComplexJs(x.re, x.im) / 2;
  const im = Math.atan2(x.im, temp) / 2;
  return new Complex(re, noIM ? -im : im);
}

/** complex.js 2.4.2 `acoth` (compat oracle only). */
export function complexJsAcoth(z: Complex): Complex {
  const a = z.re;
  const b = z.im;
  if (a === 0 && b === 0) {
    return new Complex(0, Math.PI / 2);
  }
  const d = a * a + b * b;
  if (d !== 0) {
    return complexJsAtanh(new Complex(a / d, -b / d));
  }
  return complexJsAtanh(new Complex(a !== 0 ? a / 0 : 0, b !== 0 ? -b / 0 : 0));
}

/** complex.js 2.4.2 `acsch` (compat oracle only). */
export function complexJsAcsch(z: Complex): Complex {
  const a = z.re;
  const b = z.im;
  if (b === 0) {
    return new Complex(a !== 0 ? Math.log(a + Math.sqrt(a * a + 1)) : Infinity, 0);
  }
  const d = a * a + b * b;
  if (d !== 0) {
    return complexJsAsinh(new Complex(a / d, -b / d));
  }
  return complexJsAsinh(new Complex(a !== 0 ? a / 0 : 0, b !== 0 ? -b / 0 : 0));
}

/** complex.js 2.4.2 `asech` (compat oracle only). */
export function complexJsAsech(z: Complex): Complex {
  const a = z.re;
  const b = z.im;
  if (a === 0 && b === 0) {
    return new Complex(Infinity, Infinity);
  }
  const d = a * a + b * b;
  if (d !== 0) {
    return complexJsAcosh(new Complex(a / d, -b / d));
  }
  return complexJsAcosh(new Complex(a !== 0 ? a / 0 : 0, b !== 0 ? -b / 0 : 0));
}

/** complex.js-style `acsc` via ported `asin` (compat oracle only). */
export function complexJsAcsc(z: Complex): Complex {
  const a = z.re;
  const b = z.im;
  if (a === 0 && b === 0) {
    return new Complex(0, Infinity);
  }
  const d = a * a + b * b;
  if (d !== 0) {
    return complexJsAsin(a / d, -b / d);
  }
  return complexJsAsin(a !== 0 ? a / 0 : 0, b !== 0 ? -b / 0 : 0);
}

/** complex.js-style `asec` via ported `acos` (compat oracle only). */
export function complexJsAsec(z: Complex): Complex {
  const a = z.re;
  const b = z.im;
  if (a === 0 && b === 0) {
    return new Complex(0, Infinity);
  }
  const d = a * a + b * b;
  if (d !== 0) {
    return complexJsAcos(a / d, -b / d);
  }
  return complexJsAcos(a !== 0 ? a / 0 : 0, b !== 0 ? -b / 0 : 0);
}

function copyFunctionSurface(
  from: (...args: unknown[]) => unknown,
  to: (...args: unknown[]) => unknown
): void {
  Object.defineProperty(to, 'name', { value: from.name, configurable: true });
  Object.defineProperty(to, 'length', { value: from.length, configurable: true });
  try {
    Object.setPrototypeOf(to, Object.getPrototypeOf(from));
  } catch {
    // exotic functions may refuse a prototype swap
  }
  for (const key of Object.getOwnPropertyNames(from)) {
    if (key === 'length' || key === 'name' || key === 'prototype') continue;
    try {
      const desc = Object.getOwnPropertyDescriptor(from, key);
      if (desc) Object.defineProperty(to, key, desc);
    } catch {
      // some typed-function props may be non-configurable
    }
  }
}

type CjsFn = (z: Complex) => Complex;

/** Which real zero argument gets a mathjs special value before the typed factory runs. */
export type G08ZeroCase = 'acoth' | 'acsc' | 'asec' | 'none';

/** When false, keep the factory Complex result (hand-tuned branch); when true, use complex.js on `Complex(x,0)`. */
export type G08RecomputePolicy = (x: number) => boolean;

/** Real arguments strictly between -1 and 1 use complex.js after factory complex promotion. */
export const recomputeInsideUnitDisk: G08RecomputePolicy = (x) => x > -1 && x < 1;

/** Wrap a factory so Complex and selected real promotions use the complex.js adapter. */
export function wrapG08InverseHyperbolic(
  base: (...args: unknown[]) => unknown,
  mathjs: CjsFn,
  options: { zeroCase?: G08ZeroCase; recompute?: G08RecomputePolicy } = {}
): (...args: unknown[]) => unknown {
  const zeroCase = options.zeroCase ?? 'none';
  const recompute = options.recompute ?? (() => true);
  const wrapped = function (this: unknown, ...args: unknown[]) {
    const x = args[0];
    if (isComplex(x)) return compatDecimalResult(mathjs(x));
    if (typeof x === 'number' && Object.is(x, 0)) {
      if (zeroCase === 'acoth') return new Complex(0, Math.PI / 2);
      if (zeroCase === 'acsc' || zeroCase === 'asec') return new Complex(0, Infinity);
    }
    const result = base.apply(this, args);
    if (!isComplex(result)) return compatDecimalResult(result);
    if (typeof x === 'number' && recompute(x)) {
      return compatDecimalResult(mathjs(new Complex(x, 0)));
    }
    if (isBigNumber(x)) {
      const n = (x as { toNumber(): number }).toNumber();
      if (recompute(n)) return compatDecimalResult(mathjs(new Complex(n, 0)));
    }
    return compatDecimalResult(result);
  };
  copyFunctionSurface(base, wrapped);
  return wrapped;
}
