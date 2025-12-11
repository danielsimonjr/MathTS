/**
 * Typed Trigonometric Functions
 *
 * Polymorphic trigonometric operations using typed-function.
 * Supports Complex and BigNumber types.
 *
 * @packageDocumentation
 */

import {
  mathTyped,
  Complex,
  BigNumber,
} from '@mathts/core';

// =============================================================================
// Basic Trigonometric Functions
// =============================================================================

/**
 * Sine function
 */
export const sin = mathTyped('sin', {
  'number': (a: number) => Math.sin(a),
  'Complex': (a: Complex) => a.sin(),
  'BigNumber': (a: BigNumber) => a.sin(),
});

/**
 * Cosine function
 */
export const cos = mathTyped('cos', {
  'number': (a: number) => Math.cos(a),
  'Complex': (a: Complex) => a.cos(),
  'BigNumber': (a: BigNumber) => a.cos(),
});

/**
 * Tangent function
 */
export const tan = mathTyped('tan', {
  'number': (a: number) => Math.tan(a),
  'Complex': (a: Complex) => a.tan(),
  'BigNumber': (a: BigNumber) => a.tan(),
});

/**
 * Cosecant function (1/sin)
 */
export const csc = mathTyped('csc', {
  'number': (a: number) => 1 / Math.sin(a),
  'Complex': (a: Complex) => a.sin().reciprocal(),
  'BigNumber': (a: BigNumber) => BigNumber.fromNumber(1).div(a.sin()),
});

/**
 * Secant function (1/cos)
 */
export const sec = mathTyped('sec', {
  'number': (a: number) => 1 / Math.cos(a),
  'Complex': (a: Complex) => a.cos().reciprocal(),
  'BigNumber': (a: BigNumber) => BigNumber.fromNumber(1).div(a.cos()),
});

/**
 * Cotangent function (1/tan)
 */
export const cot = mathTyped('cot', {
  'number': (a: number) => 1 / Math.tan(a),
  'Complex': (a: Complex) => a.tan().reciprocal(),
  'BigNumber': (a: BigNumber) => BigNumber.fromNumber(1).div(a.tan()),
});

// =============================================================================
// Inverse Trigonometric Functions
// =============================================================================

/**
 * Arc sine (inverse sine)
 */
export const asin = mathTyped('asin', {
  'number': (a: number) => {
    if (a < -1 || a > 1) {
      // Return complex result for values outside [-1, 1]
      return new Complex(a, 0).asin();
    }
    return Math.asin(a);
  },
  'Complex': (a: Complex) => a.asin(),
  'BigNumber': (a: BigNumber) => a.asin(),
});

/**
 * Arc cosine (inverse cosine)
 */
export const acos = mathTyped('acos', {
  'number': (a: number) => {
    if (a < -1 || a > 1) {
      return new Complex(a, 0).acos();
    }
    return Math.acos(a);
  },
  'Complex': (a: Complex) => a.acos(),
  'BigNumber': (a: BigNumber) => a.acos(),
});

/**
 * Arc tangent (inverse tangent)
 */
export const atan = mathTyped('atan', {
  'number': (a: number) => Math.atan(a),
  'Complex': (a: Complex) => a.atan(),
  'BigNumber': (a: BigNumber) => a.atan(),
});

/**
 * Arc tangent with two arguments (atan2)
 */
export const atan2 = mathTyped('atan2', {
  'number, number': (y: number, x: number) => Math.atan2(y, x),
});

/**
 * Arc cosecant
 */
export const acsc = mathTyped('acsc', {
  'number': (a: number) => Math.asin(1 / a),
  'Complex': (a: Complex) => a.reciprocal().asin(),
});

/**
 * Arc secant
 */
export const asec = mathTyped('asec', {
  'number': (a: number) => Math.acos(1 / a),
  'Complex': (a: Complex) => a.reciprocal().acos(),
});

/**
 * Arc cotangent
 */
export const acot = mathTyped('acot', {
  'number': (a: number) => Math.atan(1 / a),
  'Complex': (a: Complex) => a.reciprocal().atan(),
});

// =============================================================================
// Inverse Hyperbolic Functions
// =============================================================================

/**
 * Inverse hyperbolic sine
 */
export const asinh = mathTyped('asinh', {
  'number': (a: number) => Math.asinh(a),
  'Complex': (a: Complex) => a.asinh(),
  'BigNumber': (a: BigNumber) => a.asinh(),
});

/**
 * Inverse hyperbolic cosine
 */
export const acosh = mathTyped('acosh', {
  'number': (a: number) => Math.acosh(a),
  'Complex': (a: Complex) => a.acosh(),
  'BigNumber': (a: BigNumber) => a.acosh(),
});

/**
 * Inverse hyperbolic tangent
 */
export const atanh = mathTyped('atanh', {
  'number': (a: number) => Math.atanh(a),
  'Complex': (a: Complex) => a.atanh(),
  'BigNumber': (a: BigNumber) => a.atanh(),
});

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert degrees to radians
 */
export const toRadians = mathTyped('toRadians', {
  'number': (deg: number) => (deg * Math.PI) / 180,
});

/**
 * Convert radians to degrees
 */
export const toDegrees = mathTyped('toDegrees', {
  'number': (rad: number) => (rad * 180) / Math.PI,
});

/**
 * Hypotenuse (sqrt(a^2 + b^2)) without intermediate overflow
 */
export const hypot = mathTyped('hypot', {
  'number, number': (a: number, b: number) => Math.hypot(a, b),
  '...number': (...args: number[]) => Math.hypot(...args),
  'Array': (arr: number[]) => Math.hypot(...arr),
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
