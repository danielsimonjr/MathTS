/**
 * complex.js 2.4.x inverse / direct trig branch cuts for mathjs 15.3.0 compat (#1789).
 */

import { Complex, isComplex } from '@danielsimonjr/mathts-core';
import { compatDecimalResult } from './bignumber.js';
import { complexJsLog } from './complex-js-inverse-hyperbolic.js';

/** complex.js 2.4.2 `atan` on a real–imaginary pair (compat oracle only). */
function complexJsAtanPair(re: number, im: number): Complex {
  if (re === 0) {
    if (im === 1) return new Complex(0, Infinity);
    if (im === -1) return new Complex(0, -Infinity);
  }
  const d = re * re + (1.0 - im) * (1.0 - im);
  const t1 = complexJsLog((1 - im * im - re * re) / d, (-2 * re) / d);
  return new Complex(-0.5 * t1.im, 0.5 * t1.re);
}

/** complex.js 2.4.2 `atan` (compat oracle only). */
export function complexJsAtan(z: Complex): Complex {
  return complexJsAtanPair(z.re, z.im);
}

/** complex.js-style `acot` via `atan` on the reciprocal (compat oracle only). */
export function complexJsAcot(z: Complex): Complex {
  const a = z.re;
  const b = z.im;
  if (b === 0) {
    return new Complex(Math.atan2(1, a), 0);
  }
  const d = a * a + b * b;
  if (d !== 0) {
    return complexJsAtanPair(a / d, -b / d);
  }
  return complexJsAtanPair(a !== 0 ? a / 0 : 0, b !== 0 ? -b / 0 : 0);
}

type UnaryFn = (...args: unknown[]) => unknown;

/**
 * Route `Complex` inputs through the complex.js branch sheets; leave other types to the factory.
 *
 * @param base - The typed trig factory underlying the compat export.
 * @param mathjs - The complex.js oracle for one `Complex` argument.
 * @returns A unary function with the same surface as `base`.
 */
export function wrapCompatTrigComplexBranch(
  base: UnaryFn,
  mathjs: (z: Complex) => Complex
): UnaryFn {
  const wrapped: UnaryFn = (...args: unknown[]) => {
    const x = args[0];
    if (isComplex(x)) {
      base(...args);
      return compatDecimalResult(mathjs(x));
    }
    return base(...args);
  };
  Object.defineProperty(wrapped, 'name', { value: base.name, configurable: true });
  Object.defineProperty(wrapped, 'length', { value: base.length, configurable: true });
  for (const key of Reflect.ownKeys(base)) {
    if (key === 'length' || key === 'name' || key === 'prototype') continue;
    const desc = Object.getOwnPropertyDescriptor(base, key);
    if (desc && !Object.prototype.hasOwnProperty.call(wrapped, key)) {
      Object.defineProperty(wrapped, key, desc);
    }
  }
  return wrapped;
}
