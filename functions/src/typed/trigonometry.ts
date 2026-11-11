/**
 * Typed Trigonometric Functions
 *
 * Polymorphic trigonometric operations using typed-function.
 * Supports Complex, BigNumber, and Float64Array types.
 *
 * Every Float64Array signature in this file is synchronous and returns a new Float64Array.
 * sin, cos, tan, csc, sec, cot, atan and atanh ask the WASM tier first, after `loadWasm()`
 * loads the tier. For worker threads, use `parallelMap` or `computePool.applyKernel`
 * from `@danielsimonjr/mathts-parallel`.
 *
 * @packageDocumentation
 */

import { mathTyped, Complex, BigNumber, Dual } from '@danielsimonjr/mathts-core';
import type { UnitInstance } from '@danielsimonjr/mathts-core';

import { acscReal, asecReal, isPredictableMode } from './complex-promotion.js';
import { f64Unary } from './f64-kernels.js';
import { trigFromAngleUnit } from './trig-angle-unit.js';
import { elementwiseUnaryDispatch } from '../wasm/elementwise/wasm-bridge.js';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

/** 64-bit float (default for decimals) */
type f64 = number;

// =============================================================================
// Basic Trigonometric Functions
// =============================================================================

/**
 * Sine function
 */
export const sin = mathTyped('sin', {
  number: (a: f64): f64 => Math.sin(a),
  Complex: (a: Complex): Complex => a.sin(),
  BigNumber: (a: BigNumber): BigNumber => a.sin(),
  Dual: (a: Dual): Dual => a.sin(),
  Unit: (a: UnitInstance) => trigFromAngleUnit(a, 'sin', Math.sin, (z) => z.sin()),

  Float64Array: (a: Float64Array): Float64Array =>
    elementwiseUnaryDispatch('sin', a) ?? f64Unary(a, Math.sin),
});

/**
 * Cosine function
 */
export const cos = mathTyped('cos', {
  number: (a: f64): f64 => Math.cos(a),
  Complex: (a: Complex): Complex => a.cos(),
  BigNumber: (a: BigNumber): BigNumber => a.cos(),
  Dual: (a: Dual): Dual => a.cos(),
  Unit: (a: UnitInstance) => trigFromAngleUnit(a, 'cos', Math.cos, (z) => z.cos()),

  Float64Array: (a: Float64Array): Float64Array =>
    elementwiseUnaryDispatch('cos', a) ?? f64Unary(a, Math.cos),
});

/**
 * Tangent function
 */
export const tan = mathTyped('tan', {
  number: (a: f64): f64 => Math.tan(a),
  Complex: (a: Complex): Complex => a.tan(),
  BigNumber: (a: BigNumber): BigNumber => a.tan(),
  Dual: (a: Dual): Dual => a.tan(),
  Unit: (a: UnitInstance) => trigFromAngleUnit(a, 'tan', Math.tan, (z) => z.tan()),

  Float64Array: (a: Float64Array): Float64Array =>
    elementwiseUnaryDispatch('tan', a) ?? f64Unary(a, Math.tan),
});

/**
 * Cosecant function (1/sin)
 */
export const csc = mathTyped('csc', {
  number: (a: number) => 1 / Math.sin(a),
  Complex: (a: Complex) => a.sin().inverse(),
  BigNumber: (a: BigNumber) => BigNumber.fromNumber(1).divide(a.sin()),
  Unit: (a: UnitInstance) =>
    trigFromAngleUnit(
      a,
      'csc',
      (x) => 1 / Math.sin(x),
      (z) => z.sin().inverse()
    ),

  Float64Array: (a: Float64Array): Float64Array =>
    elementwiseUnaryDispatch('csc', a) ?? f64Unary(a, (x) => 1 / Math.sin(x)),
});

/**
 * Secant function (1/cos)
 */
export const sec = mathTyped('sec', {
  number: (a: number) => 1 / Math.cos(a),
  Complex: (a: Complex) => a.cos().inverse(),
  BigNumber: (a: BigNumber) => BigNumber.fromNumber(1).divide(a.cos()),
  Unit: (a: UnitInstance) =>
    trigFromAngleUnit(
      a,
      'sec',
      (x) => 1 / Math.cos(x),
      (z) => z.cos().inverse()
    ),

  Float64Array: (a: Float64Array): Float64Array =>
    elementwiseUnaryDispatch('sec', a) ?? f64Unary(a, (x) => 1 / Math.cos(x)),
});

/**
 * Cotangent function (1/tan)
 */
export const cot = mathTyped('cot', {
  number: (a: number) => 1 / Math.tan(a),
  Complex: (a: Complex) => a.tan().inverse(),
  BigNumber: (a: BigNumber) => BigNumber.fromNumber(1).divide(a.tan()),
  Unit: (a: UnitInstance) =>
    trigFromAngleUnit(
      a,
      'cot',
      (x) => 1 / Math.tan(x),
      (z) => z.tan().inverse()
    ),

  Float64Array: (a: Float64Array): Float64Array =>
    elementwiseUnaryDispatch('cot', a) ?? f64Unary(a, (x) => 1 / Math.tan(x)),
});

// =============================================================================
// Inverse Trigonometric Functions
// =============================================================================

/**
 * Arc sine (inverse sine)
 */
export const asin = mathTyped('asin', {
  number: (a: number) => {
    if ((a >= -1 && a <= 1) || isPredictableMode()) {
      return Math.asin(a);
    }
    return new Complex(a, 0).asin();
  },
  Complex: (a: Complex) => a.asin(),
  BigNumber: (a: BigNumber) => a.asin(),

  // Values outside the real domain give NaN, as Math.asin does.
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, Math.asin),
});

/**
 * Arc cosine (inverse cosine)
 */
export const acos = mathTyped('acos', {
  number: (a: number) => {
    if ((a >= -1 && a <= 1) || isPredictableMode()) {
      return Math.acos(a);
    }
    return new Complex(a, 0).acos();
  },
  Complex: (a: Complex) => a.acos(),
  BigNumber: (a: BigNumber) => a.acos(),

  // Values outside the real domain give NaN, as Math.acos does.
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, Math.acos),
});

/**
 * Arc tangent (inverse tangent)
 */
export const atan = mathTyped('atan', {
  number: (a: number) => Math.atan(a),
  Complex: (a: Complex) => a.atan(),
  BigNumber: (a: BigNumber) => a.atan(),

  Float64Array: (a: Float64Array): Float64Array =>
    elementwiseUnaryDispatch('atan', a) ?? f64Unary(a, Math.atan),
});

/**
 * Arc tangent with two arguments (atan2)
 */
export const atan2 = mathTyped('atan2', {
  'number, number': (y: number, x: number) => Math.atan2(y, x),
  'BigNumber, BigNumber': (y: BigNumber, x: BigNumber): BigNumber => y.atan2(x),
});

/**
 * Arc cosecant
 */
export const acsc = mathTyped('acsc', {
  number: (a: number) => acscReal(a),
  Complex: (a: Complex) => a.inverse().asin(),
  // BigNumber: acsc(a) = asin(1/a) — matches the forward csc's BigNumber path.
  BigNumber: (a: BigNumber) => BigNumber.fromNumber(1).divide(a).asin(),
});

/**
 * Arc secant
 */
export const asec = mathTyped('asec', {
  number: (a: number) => asecReal(a),
  Complex: (a: Complex) => a.inverse().acos(),
  // BigNumber: asec(a) = acos(1/a).
  BigNumber: (a: BigNumber) => BigNumber.fromNumber(1).divide(a).acos(),
});

/**
 * Arc cotangent
 */
export const acot = mathTyped('acot', {
  number: (a: number) => Math.atan(1 / a),
  Complex: (a: Complex) => a.inverse().atan(),
  // BigNumber: acot(a) = atan(1/a).
  BigNumber: (a: BigNumber) => BigNumber.fromNumber(1).divide(a).atan(),
});

// =============================================================================
// Inverse Hyperbolic Functions
// =============================================================================

/**
 * Inverse hyperbolic sine
 */
export const asinh = mathTyped('asinh', {
  number: (a: number) => Math.asinh(a),
  Complex: (a: Complex) => a.asinh(),
  BigNumber: (a: BigNumber) => a.asinh(),

  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, Math.asinh),
});

/**
 * Inverse hyperbolic cosine
 */
export const acosh = mathTyped('acosh', {
  number: (a: number) => {
    if (a >= 1 || isPredictableMode()) {
      return Math.acosh(a);
    }
    if (a <= -1) {
      return new Complex(Math.log(Math.sqrt(a * a - 1) - a), Math.PI);
    }
    return new Complex(a, 0).acosh();
  },
  Complex: (a: Complex) => a.acosh(),
  BigNumber: (a: BigNumber) => a.acosh(),

  // Values outside the real domain give NaN, as Math.acosh does.
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, Math.acosh),
});

/**
 * Inverse hyperbolic tangent
 */
export const atanh = mathTyped('atanh', {
  number: (a: number) => {
    if ((a <= 1 && a >= -1) || isPredictableMode()) {
      return Math.atanh(a);
    }
    return new Complex(a, 0).atanh();
  },
  Complex: (a: Complex) => a.atanh(),
  BigNumber: (a: BigNumber) => a.atanh(),

  // Values outside the real domain give NaN, as Math.atanh does.
  Float64Array: (a: Float64Array): Float64Array =>
    elementwiseUnaryDispatch('atanh', a) ?? f64Unary(a, Math.atanh),
});

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert degrees to radians
 */
export const toRadians = mathTyped('toRadians', {
  number: (deg: number) => (deg * Math.PI) / 180,
});

/**
 * Convert radians to degrees
 */
export const toDegrees = mathTyped('toDegrees', {
  number: (rad: number) => (rad * 180) / Math.PI,
});

/**
 * Hypotenuse (sqrt(a^2 + b^2)) without intermediate overflow
 */
export const hypot = mathTyped('hypot', {
  number: (a: number) => Math.abs(a),
  'number, number': (a: number, b: number) => Math.hypot(a, b),
  'number, number, ...number': (a: number, b: number, rest: number[]) => Math.hypot(a, b, ...rest),
  Array: (arr: number[]) => Math.hypot(...arr),
});

// =============================================================================
// Export all functions
// =============================================================================

export const typedTrigonometry = {
  // Basic
  sin,
  cos,
  tan,
  csc,
  sec,
  cot,

  // Inverse
  asin,
  acos,
  atan,
  atan2,
  acsc,
  asec,
  acot,

  // Inverse hyperbolic
  asinh,
  acosh,
  atanh,

  // Utility
  toRadians,
  toDegrees,
  hypot,
};
