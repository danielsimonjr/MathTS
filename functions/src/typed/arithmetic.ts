/**
 * Typed Arithmetic Functions
 *
 * Polymorphic arithmetic operations using typed-function for runtime dispatch.
 * Supports Complex, Fraction, BigNumber, and Matrix types.
 *
 * @packageDocumentation
 */

import {
  mathTyped,
  Complex,
  Fraction,
  BigNumber,
} from '@mathts/core';

// =============================================================================
// Addition
// =============================================================================

/**
 * Polymorphic addition function
 *
 * @example
 * ```typescript
 * add(1, 2);                          // 3
 * add(new Complex(1, 2), new Complex(3, 4)); // Complex(4, 6)
 * add(new Fraction(1, 2), new Fraction(1, 3)); // Fraction(5, 6)
 * ```
 */
export const add = mathTyped('add', {
  'number, number': (a: number, b: number) => a + b,

  'bigint, bigint': (a: bigint, b: bigint) => a + b,

  'Complex, Complex': (a: Complex, b: Complex) => a.add(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction) => a.add(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.add(b),

  // Mixed type operations (auto-coercion via conversions)
  'number, Complex': (a: number, b: Complex) => Complex.fromNumber(a).add(b),
  'Complex, number': (a: Complex, b: number) => a.add(Complex.fromNumber(b)),

  'number, Fraction': (a: number, b: Fraction) => Fraction.fromNumber(a).add(b),
  'Fraction, number': (a: Fraction, b: number) => a.add(Fraction.fromNumber(b)),

  'number, BigNumber': (a: number, b: BigNumber) => BigNumber.fromNumber(a).add(b),
  'BigNumber, number': (a: BigNumber, b: number) => a.add(BigNumber.fromNumber(b)),

  // Variadic addition
  'number, number, ...number': (a: number, b: number, ...rest: number[]) =>
    rest.reduce((acc, val) => acc + val, a + b),
});

// =============================================================================
// Subtraction
// =============================================================================

/**
 * Polymorphic subtraction function
 */
export const subtract = mathTyped('subtract', {
  'number, number': (a: number, b: number) => a - b,

  'bigint, bigint': (a: bigint, b: bigint) => a - b,

  'Complex, Complex': (a: Complex, b: Complex) => a.subtract(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction) => a.subtract(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.subtract(b),

  'number, Complex': (a: number, b: Complex) => Complex.fromNumber(a).subtract(b),
  'Complex, number': (a: Complex, b: number) => a.subtract(Complex.fromNumber(b)),

  'number, Fraction': (a: number, b: Fraction) => Fraction.fromNumber(a).subtract(b),
  'Fraction, number': (a: Fraction, b: number) => a.subtract(Fraction.fromNumber(b)),

  'number, BigNumber': (a: number, b: BigNumber) => BigNumber.fromNumber(a).subtract(b),
  'BigNumber, number': (a: BigNumber, b: number) => a.subtract(BigNumber.fromNumber(b)),
});

// =============================================================================
// Multiplication
// =============================================================================

/**
 * Polymorphic multiplication function
 */
export const multiply = mathTyped('multiply', {
  'number, number': (a: number, b: number) => a * b,

  'bigint, bigint': (a: bigint, b: bigint) => a * b,

  'Complex, Complex': (a: Complex, b: Complex) => a.multiply(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction) => a.multiply(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.multiply(b),

  'number, Complex': (a: number, b: Complex) => b.multiply(Complex.fromNumber(a)),
  'Complex, number': (a: Complex, b: number) => a.multiply(Complex.fromNumber(b)),

  'number, Fraction': (a: number, b: Fraction) => b.multiply(Fraction.fromNumber(a)),
  'Fraction, number': (a: Fraction, b: number) => a.multiply(Fraction.fromNumber(b)),

  'number, BigNumber': (a: number, b: BigNumber) => b.multiply(BigNumber.fromNumber(a)),
  'BigNumber, number': (a: BigNumber, b: number) => a.multiply(BigNumber.fromNumber(b)),

  // Variadic multiplication
  'number, number, ...number': (a: number, b: number, ...rest: number[]) =>
    rest.reduce((acc, val) => acc * val, a * b),
});

// =============================================================================
// Division
// =============================================================================

/**
 * Polymorphic division function
 */
export const divide = mathTyped('divide', {
  'number, number': (a: number, b: number) => a / b,

  'bigint, bigint': (a: bigint, b: bigint) => a / b,

  'Complex, Complex': (a: Complex, b: Complex) => a.divide(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction) => a.divide(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.divide(b),

  'number, Complex': (a: number, b: Complex) => Complex.fromNumber(a).divide(b),
  'Complex, number': (a: Complex, b: number) => a.divide(Complex.fromNumber(b)),

  'number, Fraction': (a: number, b: Fraction) => Fraction.fromNumber(a).divide(b),
  'Fraction, number': (a: Fraction, b: number) => a.divide(Fraction.fromNumber(b)),

  'number, BigNumber': (a: number, b: BigNumber) => BigNumber.fromNumber(a).divide(b),
  'BigNumber, number': (a: BigNumber, b: number) => a.divide(BigNumber.fromNumber(b)),
});

// =============================================================================
// Unary Operations
// =============================================================================

/**
 * Unary negation
 */
export const unaryMinus = mathTyped('unaryMinus', {
  'number': (a: number) => -a,
  'bigint': (a: bigint) => -a,
  'Complex': (a: Complex) => a.neg(),
  'Fraction': (a: Fraction) => a.neg(),
  'BigNumber': (a: BigNumber) => a.neg(),
});

/**
 * Unary plus (identity)
 */
export const unaryPlus = mathTyped('unaryPlus', {
  'number': (a: number) => +a,
  'bigint': (a: bigint) => a,
  'Complex': (a: Complex) => a,
  'Fraction': (a: Fraction) => a,
  'BigNumber': (a: BigNumber) => a,
});

/**
 * Absolute value
 */
export const abs = mathTyped('abs', {
  'number': (a: number) => Math.abs(a),
  'bigint': (a: bigint) => (a < 0n ? -a : a),
  'Complex': (a: Complex) => a.abs(),
  'Fraction': (a: Fraction) => a.abs(),
  'BigNumber': (a: BigNumber) => a.abs(),
});

/**
 * Sign function
 */
export const sign = mathTyped('sign', {
  'number': (a: number) => Math.sign(a),
  'bigint': (a: bigint) => (a > 0n ? 1n : a < 0n ? -1n : 0n),
  'Fraction': (a: Fraction) => new Fraction(BigInt(a.sign()), 1n),
  'BigNumber': (a: BigNumber) => BigNumber.fromNumber(a.sign()),
});

// =============================================================================
// Power and Root Operations
// =============================================================================

/**
 * Power function
 */
export const pow = mathTyped('pow', {
  'number, number': (a: number, b: number) => Math.pow(a, b),
  'bigint, bigint': (a: bigint, b: bigint) => a ** b,
  'Complex, number': (a: Complex, b: number) => a.pow(b),
  'Complex, Complex': (a: Complex, b: Complex) => a.pow(b),
  'Fraction, number': (a: Fraction, b: number) => a.pow(Math.floor(b)),
  'BigNumber, number': (a: BigNumber, b: number) => a.pow(b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.pow(b),
});

/**
 * Square root
 */
export const sqrt = mathTyped('sqrt', {
  'number': (a: number) => {
    if (a < 0) {
      return new Complex(0, Math.sqrt(-a));
    }
    return Math.sqrt(a);
  },
  'Complex': (a: Complex) => a.sqrt(),
  'BigNumber': (a: BigNumber) => a.sqrt(),
});

/**
 * Square
 */
export const square = mathTyped('square', {
  'number': (a: number) => a * a,
  'bigint': (a: bigint) => a * a,
  'Complex': (a: Complex) => a.multiply(a),
  'Fraction': (a: Fraction) => a.multiply(a),
  'BigNumber': (a: BigNumber) => a.multiply(a),
});

/**
 * Cube
 */
export const cube = mathTyped('cube', {
  'number': (a: number) => a * a * a,
  'bigint': (a: bigint) => a * a * a,
  'Complex': (a: Complex) => a.multiply(a).multiply(a),
  'Fraction': (a: Fraction) => a.multiply(a).multiply(a),
  'BigNumber': (a: BigNumber) => a.multiply(a).multiply(a),
});

/**
 * Cube root
 */
export const cbrt = mathTyped('cbrt', {
  'number': (a: number) => Math.cbrt(a),
  'Complex': (a: Complex) => a.pow(1 / 3),
  'BigNumber': (a: BigNumber) => a.cbrt(),
});

/**
 * N-th root
 */
export const nthRoot = mathTyped('nthRoot', {
  'number, number': (a: number, n: number) => Math.pow(a, 1 / n),
  'Complex, number': (a: Complex, n: number) => a.pow(1 / n),
  'BigNumber, number': (a: BigNumber, n: number) => a.pow(1 / n),
});

// =============================================================================
// Exponential and Logarithmic
// =============================================================================

/**
 * Exponential function (e^x)
 */
export const exp = mathTyped('exp', {
  'number': (a: number) => Math.exp(a),
  'Complex': (a: Complex) => a.exp(),
  'BigNumber': (a: BigNumber) => a.exp(),
});

/**
 * Natural logarithm (ln x)
 */
export const log = mathTyped('log', {
  'number': (a: number) => Math.log(a),
  'Complex': (a: Complex) => a.log(),
  'BigNumber': (a: BigNumber) => a.ln(),
  'number, number': (a: number, base: number) => Math.log(a) / Math.log(base),
});

/**
 * Base-10 logarithm
 */
export const log10 = mathTyped('log10', {
  'number': (a: number) => Math.log10(a),
  'Complex': (a: Complex) => a.log().divide(Complex.fromNumber(Math.LN10)),
  'BigNumber': (a: BigNumber) => a.log10(),
});

/**
 * Base-2 logarithm
 */
export const log2 = mathTyped('log2', {
  'number': (a: number) => Math.log2(a),
  'Complex': (a: Complex) => a.log().divide(Complex.fromNumber(Math.LN2)),
  'BigNumber': (a: BigNumber) => a.log2(),
});

/**
 * log(1 + x) with higher precision for small x
 */
export const log1p = mathTyped('log1p', {
  'number': (a: number) => Math.log1p(a),
});

/**
 * exp(x) - 1 with higher precision for small x
 */
export const expm1 = mathTyped('expm1', {
  'number': (a: number) => Math.expm1(a),
});

// =============================================================================
// Rounding Operations
// =============================================================================

/**
 * Round to nearest integer
 */
export const round = mathTyped('round', {
  'number': (a: number) => Math.round(a),
  'Fraction': (a: Fraction) => a.round(),
  'BigNumber': (a: BigNumber) => a.round(),
  'number, number': (a: number, decimals: number) => {
    const factor = Math.pow(10, decimals);
    return Math.round(a * factor) / factor;
  },
});

/**
 * Floor (round down)
 */
export const floor = mathTyped('floor', {
  'number': (a: number) => Math.floor(a),
  'Fraction': (a: Fraction) => a.floor(),
  'BigNumber': (a: BigNumber) => a.floor(),
});

/**
 * Ceiling (round up)
 */
export const ceil = mathTyped('ceil', {
  'number': (a: number) => Math.ceil(a),
  'Fraction': (a: Fraction) => a.ceil(),
  'BigNumber': (a: BigNumber) => a.ceil(),
});

/**
 * Truncate (round toward zero)
 */
export const fix = mathTyped('fix', {
  'number': (a: number) => Math.trunc(a),
  'Fraction': (a: Fraction) => a.trunc(),
  'BigNumber': (a: BigNumber) => a.trunc(),
});

// =============================================================================
// Modular Operations
// =============================================================================

/**
 * Modulo operation
 */
export const mod = mathTyped('mod', {
  'number, number': (a: number, b: number) => ((a % b) + b) % b,
  'bigint, bigint': (a: bigint, b: bigint) => ((a % b) + b) % b,
  'Fraction, Fraction': (a: Fraction, b: Fraction) => a.mod(b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.mod(b),
});

/**
 * Greatest common divisor
 */
export const gcd = mathTyped('gcd', {
  'number, number': (a: number, b: number) => {
    a = Math.abs(Math.floor(a));
    b = Math.abs(Math.floor(b));
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  },
  'bigint, bigint': (a: bigint, b: bigint) => {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  },
});

/**
 * Least common multiple
 */
export const lcm = mathTyped('lcm', {
  'number, number': (a: number, b: number) => {
    const g = gcd(a, b) as number;
    return Math.abs(a * b) / g;
  },
  'bigint, bigint': (a: bigint, b: bigint) => {
    const g = gcd(a, b) as bigint;
    const absA = a < 0n ? -a : a;
    const absB = b < 0n ? -b : b;
    return (absA * absB) / g;
  },
});

/**
 * Extended greatest common divisor
 * Returns [gcd, x, y] where gcd = a*x + b*y (Bezout coefficients)
 */
export const xgcd = mathTyped('xgcd', {
  'number, number': (a: number, b: number): [number, number, number] => {
    a = Math.floor(a);
    b = Math.floor(b);
    let x = 0, lastX = 1;
    let y = 1, lastY = 0;
    while (b !== 0) {
      const q = Math.floor(a / b);
      [a, b] = [b, a % b];
      [x, lastX] = [lastX - q * x, x];
      [y, lastY] = [lastY - q * y, y];
    }
    return a < 0 ? [-a, -lastX, -lastY] : [a, lastX, lastY];
  },
  'bigint, bigint': (a: bigint, b: bigint): [bigint, bigint, bigint] => {
    let x = 0n, lastX = 1n;
    let y = 1n, lastY = 0n;
    while (b !== 0n) {
      const q = a / b;
      [a, b] = [b, a % b];
      [x, lastX] = [lastX - q * x, x];
      [y, lastY] = [lastY - q * y, y];
    }
    return a < 0n ? [-a, -lastX, -lastY] : [a, lastX, lastY];
  },
});

/**
 * Vector/array norm (Euclidean norm by default)
 */
export const norm = mathTyped('norm', {
  'number': (a: number) => Math.abs(a),
  'Complex': (a: Complex) => a.abs(),
  'BigNumber': (a: BigNumber) => a.abs(),
  'Array': (arr: number[]) => Math.sqrt(arr.reduce((sum, x) => sum + x * x, 0)),
  'Array, number': (arr: number[], p: number) => {
    if (p === Infinity) return Math.max(...arr.map(Math.abs));
    if (p === -Infinity) return Math.min(...arr.map(Math.abs));
    if (p === 0) return arr.filter(x => x !== 0).length;
    return Math.pow(arr.reduce((sum, x) => sum + Math.pow(Math.abs(x), p), 0), 1/p);
  },
});

// =============================================================================
// Hyperbolic Functions
// =============================================================================

/**
 * Hyperbolic sine
 */
export const sinh = mathTyped('sinh', {
  'number': (a: number) => Math.sinh(a),
  'Complex': (a: Complex) => a.sinh(),
  'BigNumber': (a: BigNumber) => a.sinh(),
});

/**
 * Hyperbolic cosine
 */
export const cosh = mathTyped('cosh', {
  'number': (a: number) => Math.cosh(a),
  'Complex': (a: Complex) => a.cosh(),
  'BigNumber': (a: BigNumber) => a.cosh(),
});

/**
 * Hyperbolic tangent
 */
export const tanh = mathTyped('tanh', {
  'number': (a: number) => Math.tanh(a),
  'Complex': (a: Complex) => a.tanh(),
  'BigNumber': (a: BigNumber) => a.tanh(),
});

// =============================================================================
// Comparison Operations
// =============================================================================

/**
 * Check if values are equal
 */
export const equal = mathTyped('equal', {
  'number, number': (a: number, b: number) => a === b,
  'bigint, bigint': (a: bigint, b: bigint) => a === b,
  'Complex, Complex': (a: Complex, b: Complex) => a.equals(b),
  'Fraction, Fraction': (a: Fraction, b: Fraction) => a.equals(b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.equals(b),
});

/**
 * Check if a < b
 */
export const smaller = mathTyped('smaller', {
  'number, number': (a: number, b: number) => a < b,
  'bigint, bigint': (a: bigint, b: bigint) => a < b,
  'Fraction, Fraction': (a: Fraction, b: Fraction) => a.compare(b) < 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.compare(b) < 0,
});

/**
 * Check if a > b
 */
export const larger = mathTyped('larger', {
  'number, number': (a: number, b: number) => a > b,
  'bigint, bigint': (a: bigint, b: bigint) => a > b,
  'Fraction, Fraction': (a: Fraction, b: Fraction) => a.compare(b) > 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.compare(b) > 0,
});

/**
 * Check if a <= b
 */
export const smallerEq = mathTyped('smallerEq', {
  'number, number': (a: number, b: number) => a <= b,
  'bigint, bigint': (a: bigint, b: bigint) => a <= b,
  'Fraction, Fraction': (a: Fraction, b: Fraction) => a.compare(b) <= 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.compare(b) <= 0,
});

/**
 * Check if a >= b
 */
export const largerEq = mathTyped('largerEq', {
  'number, number': (a: number, b: number) => a >= b,
  'bigint, bigint': (a: bigint, b: bigint) => a >= b,
  'Fraction, Fraction': (a: Fraction, b: Fraction) => a.compare(b) >= 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.compare(b) >= 0,
});

/**
 * Compare two values: -1, 0, or 1
 */
export const compare = mathTyped('compare', {
  'number, number': (a: number, b: number) => (a > b ? 1 : a < b ? -1 : 0),
  'bigint, bigint': (a: bigint, b: bigint) => (a > b ? 1 : a < b ? -1 : 0),
  'Fraction, Fraction': (a: Fraction, b: Fraction) => a.compare(b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => a.compare(b),
});

// =============================================================================
// Min/Max Operations
// =============================================================================

/**
 * Minimum of values
 */
export const min = mathTyped('min', {
  'bigint, bigint': (a: bigint, b: bigint) => (a < b ? a : b),
  'Fraction, Fraction': (a: Fraction, b: Fraction) => (a.compare(b) < 0 ? a : b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => (a.compare(b) < 0 ? a : b),
  'Array': (arr: number[]) => Math.min(...arr),
  'number': (a: number) => a,
  'number, number': (a: number, b: number) => Math.min(a, b),
  'number, number, ...number': (a: number, b: number, ...rest: number[]) => Math.min(a, b, ...rest),
});

/**
 * Maximum of values
 */
export const max = mathTyped('max', {
  'bigint, bigint': (a: bigint, b: bigint) => (a > b ? a : b),
  'Fraction, Fraction': (a: Fraction, b: Fraction) => (a.compare(b) > 0 ? a : b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber) => (a.compare(b) > 0 ? a : b),
  'Array': (arr: number[]) => Math.max(...arr),
  'number': (a: number) => a,
  'number, number': (a: number, b: number) => Math.max(a, b),
  'number, number, ...number': (a: number, b: number, ...rest: number[]) => Math.max(a, b, ...rest),
});

// =============================================================================
// Export all functions
// =============================================================================

export const typedArithmetic = {
  // Basic operations
  add,
  subtract,
  multiply,
  divide,

  // Unary
  unaryMinus,
  unaryPlus,
  abs,
  sign,

  // Power/root
  pow,
  sqrt,
  square,
  cube,
  cbrt,
  nthRoot,

  // Exponential/logarithmic
  exp,
  log,
  log10,
  log2,
  log1p,
  expm1,

  // Rounding
  round,
  floor,
  ceil,
  fix,

  // Modular
  mod,
  gcd,
  lcm,
  xgcd,

  // Norm
  norm,

  // Hyperbolic
  sinh,
  cosh,
  tanh,

  // Comparison
  equal,
  smaller,
  larger,
  smallerEq,
  largerEq,
  compare,

  // Min/max
  min,
  max,
};
