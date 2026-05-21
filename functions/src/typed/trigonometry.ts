/**
 * Typed Trigonometric Functions (Parallel-First)
 *
 * Polymorphic trigonometric operations using typed-function.
 * Supports Complex, BigNumber, and Float64Array types.
 *
 * Following the parallel-first philosophy per CLAUDE.md:
 * - Use workers for ALL array transformations (Float64Array)
 * - Use workers for ALL numerical computations that can be batched
 * - Only fall back to sequential for trivial scalar operations
 *
 * @packageDocumentation
 */

import {
  mathTyped,
  Complex,
  BigNumber,
} from '@danielsimonjr/mathts-core';

import { computePool } from '@danielsimonjr/mathts-parallel';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

/** 64-bit float (default for decimals) */
type f64 = number;

// =============================================================================
// Basic Trigonometric Functions
// =============================================================================

/**
 * Sine function with parallel array support
 */
export const sin = mathTyped('sin', {
  'number': (a: f64): f64 => Math.sin(a),
  'Complex': (a: Complex): Complex => a.sin(),
  'BigNumber': (a: BigNumber): BigNumber => a.sin(),

  // Parallel Float64Array sin
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.sin(a);
    return result.result;
  },
});

/**
 * Cosine function with parallel array support
 */
export const cos = mathTyped('cos', {
  'number': (a: f64): f64 => Math.cos(a),
  'Complex': (a: Complex): Complex => a.cos(),
  'BigNumber': (a: BigNumber): BigNumber => a.cos(),

  // Parallel Float64Array cos
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.cos(a);
    return result.result;
  },
});

/**
 * Tangent function with parallel array support
 */
export const tan = mathTyped('tan', {
  'number': (a: f64): f64 => Math.tan(a),
  'Complex': (a: Complex): Complex => a.tan(),
  'BigNumber': (a: BigNumber): BigNumber => a.tan(),

  // Parallel Float64Array tan
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.tan(a);
    return result.result;
  },
});

/**
 * Cosecant function (1/sin)
 */
export const csc = mathTyped('csc', {
  'number': (a: number) => 1 / Math.sin(a),
  'Complex': (a: Complex) => a.sin().inverse(),
  'BigNumber': (a: BigNumber) => BigNumber.fromNumber(1).divide(a.sin()),

  // Parallel array csc
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => 1 / Math.sin(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = 1 / Math.sin(a[i]);
    return out;
  },
});

/**
 * Secant function (1/cos)
 */
export const sec = mathTyped('sec', {
  'number': (a: number) => 1 / Math.cos(a),
  'Complex': (a: Complex) => a.cos().inverse(),
  'BigNumber': (a: BigNumber) => BigNumber.fromNumber(1).divide(a.cos()),

  // Parallel array sec
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => 1 / Math.cos(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = 1 / Math.cos(a[i]);
    return out;
  },
});

/**
 * Cotangent function (1/tan)
 */
export const cot = mathTyped('cot', {
  'number': (a: number) => 1 / Math.tan(a),
  'Complex': (a: Complex) => a.tan().inverse(),
  'BigNumber': (a: BigNumber) => BigNumber.fromNumber(1).divide(a.tan()),

  // Parallel array cot
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => 1 / Math.tan(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = 1 / Math.tan(a[i]);
    return out;
  },
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

  // Parallel array asin (values outside [-1, 1] produce NaN, matching Math.asin behavior)
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.asin(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.asin(a[i]);
    return out;
  },
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

  // Parallel array acos (values outside [-1, 1] produce NaN, matching Math.acos behavior)
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.acos(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.acos(a[i]);
    return out;
  },
});

/**
 * Arc tangent (inverse tangent)
 */
export const atan = mathTyped('atan', {
  'number': (a: number) => Math.atan(a),
  'Complex': (a: Complex) => a.atan(),
  'BigNumber': (a: BigNumber) => a.atan(),

  // Parallel array atan
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.atan(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.atan(a[i]);
    return out;
  },
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
  'Complex': (a: Complex) => a.inverse().asin(),
});

/**
 * Arc secant
 */
export const asec = mathTyped('asec', {
  'number': (a: number) => Math.acos(1 / a),
  'Complex': (a: Complex) => a.inverse().acos(),
});

/**
 * Arc cotangent
 */
export const acot = mathTyped('acot', {
  'number': (a: number) => Math.atan(1 / a),
  'Complex': (a: Complex) => a.inverse().atan(),
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

  // Parallel array asinh
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.asinh(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.asinh(a[i]);
    return out;
  },
});

/**
 * Inverse hyperbolic cosine
 */
export const acosh = mathTyped('acosh', {
  'number': (a: number) => Math.acosh(a),
  'Complex': (a: Complex) => a.acosh(),
  'BigNumber': (a: BigNumber) => a.acosh(),

  // Parallel array acosh (values < 1 produce NaN, matching Math.acosh behavior)
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.acosh(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.acosh(a[i]);
    return out;
  },
});

/**
 * Inverse hyperbolic tangent
 */
export const atanh = mathTyped('atanh', {
  'number': (a: number) => Math.atanh(a),
  'Complex': (a: Complex) => a.atanh(),
  'BigNumber': (a: BigNumber) => a.atanh(),

  // Parallel array atanh (values outside (-1, 1) produce NaN or ±Infinity, matching Math.atanh behavior)
  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.atanh(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.atanh(a[i]);
    return out;
  },
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
  'number': (a: number) => Math.abs(a),
  'number, number': (a: number, b: number) => Math.hypot(a, b),
  'number, number, ...number': (a: number, b: number, ...rest: number[]) => Math.hypot(a, b, ...rest),
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
