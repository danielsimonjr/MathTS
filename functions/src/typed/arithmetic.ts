/**
 * Typed Arithmetic Functions (Parallel-First)
 *
 * Polymorphic arithmetic operations using typed-function for runtime dispatch.
 * Supports Complex, Fraction, BigNumber, and Float64Array types.
 *
 * Following the parallel-first philosophy per CLAUDE.md:
 * - Use workers for ALL array transformations (Float64Array)
 * - Use workers for ALL numerical computations that can be batched
 * - Only fall back to sequential for trivial scalar operations
 *
 * @packageDocumentation
 */

import { mathTyped, Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';

import { computePool, ComputePool } from '@danielsimonjr/mathts-parallel';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

/** 64-bit float (default for decimals) */
type f64 = number;

/** 32-bit signed integer */
type i32 = number;

/** 64-bit signed integer */
type i64 = bigint;

// =============================================================================
// Addition (Parallel-First)
// =============================================================================

/**
 * Polymorphic addition function with parallel execution for arrays
 *
 * For Float64Array inputs, uses worker pool for parallel computation.
 * Falls back to sequential for scalar types.
 *
 * @example
 * ```typescript
 * add(1, 2);                                    // 3
 * add(new Complex(1, 2), new Complex(3, 4));   // Complex(4, 6)
 * add(new Fraction(1, 2), new Fraction(1, 3)); // Fraction(5, 6)
 * await add(float64A, float64B);               // Parallel array add
 * ```
 */
export const add = mathTyped('add', {
  'number, number': (a: f64, b: f64): f64 => a + b,

  'bigint, bigint': (a: i64, b: i64): i64 => a + b,

  'Complex, Complex': (a: Complex, b: Complex): Complex => a.add(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => a.add(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => a.add(b),

  // Mixed type operations (auto-coercion via conversions)
  'number, Complex': (a: f64, b: Complex): Complex => Complex.fromNumber(a).add(b),
  'Complex, number': (a: Complex, b: f64): Complex => a.add(Complex.fromNumber(b)),

  'number, Fraction': (a: f64, b: Fraction): Fraction => Fraction.fromNumber(a).add(b),
  'Fraction, number': (a: Fraction, b: f64): Fraction => a.add(Fraction.fromNumber(b)),

  'number, BigNumber': (a: f64, b: BigNumber): BigNumber => BigNumber.fromNumber(a).add(b),
  'BigNumber, number': (a: BigNumber, b: f64): BigNumber => a.add(BigNumber.fromNumber(b)),

  // Parallel array addition using ComputePool
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await computePool.add(a, b);
    return result.result;
  },

  // Variadic addition. NOTE: this repo's typed-function fork delivers
  // variadic rest args as a single array argument (`fn(a, b, [...rest])`),
  // so the parameter is declared as a plain array — no JS spread.
  'number, number, ...number': (a: f64, b: f64, rest: f64[]): f64 =>
    rest.reduce((acc: f64, val: f64): f64 => acc + val, a + b),
});

// =============================================================================
// Subtraction (Parallel-First)
// =============================================================================

/**
 * Polymorphic subtraction function with parallel execution for arrays
 */
export const subtract = mathTyped('subtract', {
  'number, number': (a: f64, b: f64): f64 => a - b,

  'bigint, bigint': (a: i64, b: i64): i64 => a - b,

  'Complex, Complex': (a: Complex, b: Complex): Complex => a.subtract(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => a.subtract(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => a.subtract(b),

  'number, Complex': (a: f64, b: Complex): Complex => Complex.fromNumber(a).subtract(b),
  'Complex, number': (a: Complex, b: f64): Complex => a.subtract(Complex.fromNumber(b)),

  'number, Fraction': (a: f64, b: Fraction): Fraction => Fraction.fromNumber(a).subtract(b),
  'Fraction, number': (a: Fraction, b: f64): Fraction => a.subtract(Fraction.fromNumber(b)),

  'number, BigNumber': (a: f64, b: BigNumber): BigNumber => BigNumber.fromNumber(a).subtract(b),
  'BigNumber, number': (a: BigNumber, b: f64): BigNumber => a.subtract(BigNumber.fromNumber(b)),

  // Parallel array subtraction
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await computePool.subtract(a, b);
    return result.result;
  },
});

// =============================================================================
// Multiplication (Parallel-First)
// =============================================================================

/**
 * Polymorphic multiplication function with parallel execution for arrays
 */
export const multiply = mathTyped('multiply', {
  'number, number': (a: f64, b: f64): f64 => a * b,

  'bigint, bigint': (a: i64, b: i64): i64 => a * b,

  'Complex, Complex': (a: Complex, b: Complex): Complex => a.multiply(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => a.multiply(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => a.multiply(b),

  'number, Complex': (a: f64, b: Complex): Complex => b.multiply(Complex.fromNumber(a)),
  'Complex, number': (a: Complex, b: f64): Complex => a.multiply(Complex.fromNumber(b)),

  'number, Fraction': (a: f64, b: Fraction): Fraction => b.multiply(Fraction.fromNumber(a)),
  'Fraction, number': (a: Fraction, b: f64): Fraction => a.multiply(Fraction.fromNumber(b)),

  'number, BigNumber': (a: f64, b: BigNumber): BigNumber => b.multiply(BigNumber.fromNumber(a)),
  'BigNumber, number': (a: BigNumber, b: f64): BigNumber => a.multiply(BigNumber.fromNumber(b)),

  // Parallel element-wise multiplication
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await computePool.multiply(a, b);
    return result.result;
  },

  // Parallel scalar multiplication (scale)
  'Float64Array, number': async (a: Float64Array, scalar: f64): Promise<Float64Array> => {
    const result = await computePool.scale(a, scalar);
    return result.result;
  },

  'number, Float64Array': async (scalar: f64, a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.scale(a, scalar);
    return result.result;
  },

  // Variadic multiplication (see variadic-add note about rest-array shape).
  'number, number, ...number': (a: f64, b: f64, rest: f64[]): f64 =>
    rest.reduce((acc: f64, val: f64): f64 => acc * val, a * b),
});

// =============================================================================
// Division (Parallel-First)
// =============================================================================

/**
 * Polymorphic division function with parallel execution for arrays
 */
export const divide = mathTyped('divide', {
  'number, number': (a: f64, b: f64): f64 => a / b,

  'bigint, bigint': (a: i64, b: i64): i64 => a / b,

  'Complex, Complex': (a: Complex, b: Complex): Complex => a.divide(b),

  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => a.divide(b),

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => a.divide(b),

  'number, Complex': (a: f64, b: Complex): Complex => Complex.fromNumber(a).divide(b),
  'Complex, number': (a: Complex, b: f64): Complex => a.divide(Complex.fromNumber(b)),

  'number, Fraction': (a: f64, b: Fraction): Fraction => Fraction.fromNumber(a).divide(b),
  'Fraction, number': (a: Fraction, b: f64): Fraction => a.divide(Fraction.fromNumber(b)),

  'number, BigNumber': (a: f64, b: BigNumber): BigNumber => BigNumber.fromNumber(a).divide(b),
  'BigNumber, number': (a: BigNumber, b: f64): BigNumber => a.divide(BigNumber.fromNumber(b)),

  // Parallel element-wise division
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<Float64Array> => {
    const result = await computePool.divide(a, b);
    return result.result;
  },
});

// =============================================================================
// Unary Operations (Parallel-First)
// =============================================================================

/**
 * Unary negation with parallel array support
 */
export const unaryMinus = mathTyped('unaryMinus', {
  number: (a: f64): f64 => -a,
  bigint: (a: i64): i64 => -a,
  Complex: (a: Complex): Complex => a.negate(),
  Fraction: (a: Fraction): Fraction => a.negate(),
  BigNumber: (a: BigNumber): BigNumber => a.negate(),

  // Parallel array negation
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.negate(a);
    return result.result;
  },
});

/**
 * Unary plus (identity)
 */
export const unaryPlus = mathTyped('unaryPlus', {
  number: (a: f64): f64 => +a,
  bigint: (a: i64): i64 => a,
  Complex: (a: Complex): Complex => a,
  Fraction: (a: Fraction): Fraction => a,
  BigNumber: (a: BigNumber): BigNumber => a,
  Float64Array: (a: Float64Array): Float64Array => a, // Identity, no copy needed
});

/**
 * Absolute value with parallel array support
 */
export const abs = mathTyped('abs', {
  number: (a: f64): f64 => Math.abs(a),
  bigint: (a: i64): i64 => (a < 0n ? -a : a),
  Complex: (a: Complex): f64 => a.abs(),
  Fraction: (a: Fraction): Fraction => a.abs(),
  BigNumber: (a: BigNumber): BigNumber => a.abs(),

  // Parallel array abs
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.abs(a);
    return result.result;
  },
});

/**
 * Sign function
 */
export const sign = mathTyped('sign', {
  number: (a: f64): f64 => Math.sign(a),
  bigint: (a: i64): i64 => (a > 0n ? 1n : a < 0n ? -1n : 0n),
  Fraction: (a: Fraction): Fraction => new Fraction(BigInt(a.sign()), 1n),
  BigNumber: (a: BigNumber): BigNumber => BigNumber.fromNumber(a.sign()),

  // Parallel array sign
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.sign(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.sign(a[i]);
    return out;
  },
});

// =============================================================================
// Power and Root Operations (Parallel-First)
// =============================================================================

/**
 * Power function
 */
export const pow = mathTyped('pow', {
  'number, number': (a: f64, b: f64): f64 => Math.pow(a, b),
  'bigint, bigint': (a: i64, b: i64): i64 => a ** b,
  'Complex, number': (a: Complex, b: f64): Complex => a.pow(b),
  'Complex, Complex': (a: Complex, b: Complex): Complex => a.pow(b),
  'Fraction, number': (a: Fraction, b: f64): Fraction => a.pow(Math.floor(b)),
  'BigNumber, number': (a: BigNumber, b: f64): BigNumber => a.pow(b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => a.pow(b.valueOf()),
});

/**
 * Square root with parallel array support
 */
export const sqrt = mathTyped('sqrt', {
  number: (a: f64): f64 | Complex => {
    if (a < 0) {
      return new Complex(0, Math.sqrt(-a));
    }
    return Math.sqrt(a);
  },
  Complex: (a: Complex): Complex => a.sqrt(),
  BigNumber: (a: BigNumber): BigNumber => a.sqrt(),

  // Parallel array sqrt
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.sqrt(a);
    return result.result;
  },
});

/**
 * Square with parallel array support
 */
export const square = mathTyped('square', {
  number: (a: f64): f64 => a * a,
  bigint: (a: i64): i64 => a * a,
  Complex: (a: Complex): Complex => a.multiply(a),
  Fraction: (a: Fraction): Fraction => a.multiply(a),
  BigNumber: (a: BigNumber): BigNumber => a.multiply(a),

  // Parallel array square
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.square(a);
    return result.result;
  },
});

/**
 * Cube
 */
export const cube = mathTyped('cube', {
  number: (a: f64): f64 => a * a * a,
  bigint: (a: i64): i64 => a * a * a,
  Complex: (a: Complex): Complex => a.multiply(a).multiply(a),
  Fraction: (a: Fraction): Fraction => a.multiply(a).multiply(a),
  BigNumber: (a: BigNumber): BigNumber => a.multiply(a).multiply(a),

  // Parallel array cube
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => x * x * x');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] * a[i] * a[i];
    return out;
  },
});

/**
 * Cube root
 */
export const cbrt = mathTyped('cbrt', {
  number: (a: f64): f64 => Math.cbrt(a),
  Complex: (a: Complex): Complex => a.pow(1 / 3),
  BigNumber: (a: BigNumber): BigNumber => a.cbrt(),

  // Parallel array cbrt
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.cbrt(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.cbrt(a[i]);
    return out;
  },
});

/**
 * N-th root
 */
export const nthRoot = mathTyped('nthRoot', {
  'number, number': (a: f64, n: f64): f64 => Math.pow(a, 1 / n),
  'Complex, number': (a: Complex, n: f64): Complex => a.pow(1 / n),
  'BigNumber, number': (a: BigNumber, n: f64): BigNumber => a.pow(1 / n),
});

// =============================================================================
// Exponential and Logarithmic (Parallel-First)
// =============================================================================

/**
 * Exponential function (e^x) with parallel array support
 */
export const exp = mathTyped('exp', {
  number: (a: f64): f64 => Math.exp(a),
  Complex: (a: Complex): Complex => a.exp(),
  BigNumber: (a: BigNumber): BigNumber => a.exp(),

  // Parallel array exp
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.exp(a);
    return result.result;
  },
});

/**
 * Natural logarithm (ln x) with parallel array support
 */
export const log = mathTyped('log', {
  number: (a: f64): f64 => Math.log(a),
  Complex: (a: Complex): Complex => a.log(),
  BigNumber: (a: BigNumber): BigNumber => a.ln(),
  'number, number': (a: f64, base: f64): f64 => Math.log(a) / Math.log(base),

  // Parallel array log
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    const result = await computePool.log(a);
    return result.result;
  },
});

/**
 * Base-10 logarithm
 */
export const log10 = mathTyped('log10', {
  number: (a: f64): f64 => Math.log10(a),
  Complex: (a: Complex): Complex => a.log().divide(Complex.fromNumber(Math.LN10)),
  BigNumber: (a: BigNumber): BigNumber => a.log10(),

  // Parallel array log10
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.log10(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.log10(a[i]);
    return out;
  },
});

/**
 * Base-2 logarithm
 */
export const log2 = mathTyped('log2', {
  number: (a: f64): f64 => Math.log2(a),
  Complex: (a: Complex): Complex => a.log().divide(Complex.fromNumber(Math.LN2)),
  BigNumber: (a: BigNumber): BigNumber => a.log2(),

  // Parallel array log2
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.log2(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.log2(a[i]);
    return out;
  },
});

/**
 * log(1 + x) with higher precision for small x
 */
export const log1p = mathTyped('log1p', {
  number: (a: f64): f64 => Math.log1p(a),

  // Parallel array log1p
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.log1p(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.log1p(a[i]);
    return out;
  },
});

/**
 * exp(x) - 1 with higher precision for small x
 */
export const expm1 = mathTyped('expm1', {
  number: (a: f64): f64 => Math.expm1(a),

  // Parallel array expm1
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.expm1(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.expm1(a[i]);
    return out;
  },
});

// =============================================================================
// Rounding Operations
// =============================================================================

/**
 * Round to nearest integer
 */
export const round = mathTyped('round', {
  number: (a: f64): f64 => Math.round(a),
  Fraction: (a: Fraction): Fraction => a.round(),
  BigNumber: (a: BigNumber): BigNumber => a.round(),
  'number, number': (a: f64, decimals: f64): f64 => {
    const factor = Math.pow(10, decimals);
    return Math.round(a * factor) / factor;
  },

  // Parallel array round (round to nearest integer, matching the 'number' overload)
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.round(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.round(a[i]);
    return out;
  },
});

/**
 * Floor (round down)
 */
export const floor = mathTyped('floor', {
  number: (a: f64): f64 => Math.floor(a),
  Fraction: (a: Fraction): Fraction => a.floor(),
  BigNumber: (a: BigNumber): BigNumber => a.floor(),

  // Parallel array floor
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.floor(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.floor(a[i]);
    return out;
  },
});

/**
 * Ceiling (round up)
 */
export const ceil = mathTyped('ceil', {
  number: (a: f64): f64 => Math.ceil(a),
  Fraction: (a: Fraction): Fraction => a.ceil(),
  BigNumber: (a: BigNumber): BigNumber => a.ceil(),

  // Parallel array ceil
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.ceil(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.ceil(a[i]);
    return out;
  },
});

/**
 * Truncate (round toward zero)
 */
export const fix = mathTyped('fix', {
  number: (a: f64): f64 => Math.trunc(a),
  Fraction: (a: Fraction): Fraction => a.trunc(),
  BigNumber: (a: BigNumber): BigNumber => a.trunc(),

  // Parallel array fix (truncate toward zero, matching the 'number' overload)
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.trunc(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.trunc(a[i]);
    return out;
  },
});

// =============================================================================
// Modular Operations
// =============================================================================

/**
 * Modulo operation
 */
export const mod = mathTyped('mod', {
  'number, number': (a: f64, b: f64): f64 => ((a % b) + b) % b,
  'bigint, bigint': (a: i64, b: i64): i64 => ((a % b) + b) % b,
  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => a.mod(b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => a.mod(b),
});

/**
 * Greatest common divisor
 */
export const gcd = mathTyped('gcd', {
  'number, number': (a: f64, b: f64): f64 => {
    a = Math.abs(Math.floor(a));
    b = Math.abs(Math.floor(b));
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  },
  'bigint, bigint': (a: i64, b: i64): i64 => {
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
  'number, number': (a: f64, b: f64): f64 => {
    const g = gcd(a, b) as number;
    return Math.abs(a * b) / g;
  },
  'bigint, bigint': (a: i64, b: i64): i64 => {
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
  'number, number': (a: f64, b: f64): [f64, f64, f64] => {
    a = Math.floor(a);
    b = Math.floor(b);
    let x = 0,
      lastX = 1;
    let y = 1,
      lastY = 0;
    while (b !== 0) {
      const q = Math.floor(a / b);
      [a, b] = [b, a % b];
      [x, lastX] = [lastX - q * x, x];
      [y, lastY] = [lastY - q * y, y];
    }
    return a < 0 ? [-a, -lastX, -lastY] : [a, lastX, lastY];
  },
  'bigint, bigint': (a: i64, b: i64): [i64, i64, i64] => {
    let x = 0n,
      lastX = 1n;
    let y = 1n,
      lastY = 0n;
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
 * Vector/array norm (Euclidean norm by default) with parallel support
 */
export const norm = mathTyped('norm', {
  number: (a: f64): f64 => Math.abs(a),
  Complex: (a: Complex): f64 => a.abs(),
  BigNumber: (a: BigNumber): BigNumber => a.abs(),
  Array: (arr: f64[]): f64 => Math.sqrt(arr.reduce((sum, x) => sum + x * x, 0)),
  'Array, number': (arr: f64[], p: f64): f64 => {
    if (p === Infinity) return Math.max(...arr.map(Math.abs));
    if (p === -Infinity) return Math.min(...arr.map(Math.abs));
    if (p === 0) return arr.filter((x) => x !== 0).length;
    return Math.pow(
      arr.reduce((sum, x) => sum + Math.pow(Math.abs(x), p), 0),
      1 / p
    );
  },

  // Parallel Float64Array norm
  Float64Array: async (a: Float64Array): Promise<f64> => {
    const result = await computePool.norm(a);
    return result.result;
  },
});

// =============================================================================
// Hyperbolic Functions
// =============================================================================

/**
 * Hyperbolic sine
 */
export const sinh = mathTyped('sinh', {
  number: (a: f64): f64 => Math.sinh(a),
  Complex: (a: Complex): Complex => a.sinh(),
  BigNumber: (a: BigNumber): BigNumber => a.sinh(),

  // Parallel array sinh
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.sinh(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.sinh(a[i]);
    return out;
  },
});

/**
 * Hyperbolic cosine
 */
export const cosh = mathTyped('cosh', {
  number: (a: f64): f64 => Math.cosh(a),
  Complex: (a: Complex): Complex => a.cosh(),
  BigNumber: (a: BigNumber): BigNumber => a.cosh(),

  // Parallel array cosh
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.cosh(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.cosh(a[i]);
    return out;
  },
});

/**
 * Hyperbolic tangent
 */
export const tanh = mathTyped('tanh', {
  number: (a: f64): f64 => Math.tanh(a),
  Complex: (a: Complex): Complex => a.tanh(),
  BigNumber: (a: BigNumber): BigNumber => a.tanh(),

  // Parallel array tanh
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    if (computePool.shouldParallelize(a.length)) {
      const r = await computePool.applyKernel(a, '(x) => Math.tanh(x)');
      return r.result;
    }
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.tanh(a[i]);
    return out;
  },
});

// =============================================================================
// Comparison Operations
// =============================================================================

/**
 * Check if values are equal
 */
export const equal = mathTyped('equal', {
  'number, number': (a: f64, b: f64): boolean => a === b,
  'bigint, bigint': (a: i64, b: i64): boolean => a === b,
  'Complex, Complex': (a: Complex, b: Complex): boolean => a.equals(b),
  'Fraction, Fraction': (a: Fraction, b: Fraction): boolean => a.equals(b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean => a.equals(b),
});

/**
 * Check if a < b
 */
export const smaller = mathTyped('smaller', {
  'number, number': (a: f64, b: f64): boolean => a < b,
  'bigint, bigint': (a: i64, b: i64): boolean => a < b,
  'Fraction, Fraction': (a: Fraction, b: Fraction): boolean => a.compare(b) < 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean => a.compare(b) < 0,
});

/**
 * Check if a > b
 */
export const larger = mathTyped('larger', {
  'number, number': (a: f64, b: f64): boolean => a > b,
  'bigint, bigint': (a: i64, b: i64): boolean => a > b,
  'Fraction, Fraction': (a: Fraction, b: Fraction): boolean => a.compare(b) > 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean => a.compare(b) > 0,
});

/**
 * Check if a <= b
 */
export const smallerEq = mathTyped('smallerEq', {
  'number, number': (a: f64, b: f64): boolean => a <= b,
  'bigint, bigint': (a: i64, b: i64): boolean => a <= b,
  'Fraction, Fraction': (a: Fraction, b: Fraction): boolean => a.compare(b) <= 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean => a.compare(b) <= 0,
});

/**
 * Check if a >= b
 */
export const largerEq = mathTyped('largerEq', {
  'number, number': (a: f64, b: f64): boolean => a >= b,
  'bigint, bigint': (a: i64, b: i64): boolean => a >= b,
  'Fraction, Fraction': (a: Fraction, b: Fraction): boolean => a.compare(b) >= 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean => a.compare(b) >= 0,
});

/**
 * Compare two values: -1, 0, or 1
 */
export const compare = mathTyped('compare', {
  'number, number': (a: f64, b: f64): i32 => (a > b ? 1 : a < b ? -1 : 0),
  'bigint, bigint': (a: i64, b: i64): i32 => (a > b ? 1 : a < b ? -1 : 0),
  'Fraction, Fraction': (a: Fraction, b: Fraction): i32 => a.compare(b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): i32 => a.compare(b),
});

// =============================================================================
// Min/Max Operations (Parallel-First)
// =============================================================================

/**
 * Minimum of values with parallel array support
 */
export const min = mathTyped('min', {
  'bigint, bigint': (a: i64, b: i64): i64 => (a < b ? a : b),
  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => (a.compare(b) < 0 ? a : b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => (a.compare(b) < 0 ? a : b),
  Array: (arr: f64[]): f64 => Math.min(...arr),
  number: (a: f64): f64 => a,
  'number, number': (a: f64, b: f64): f64 => Math.min(a, b),
  'number, number, ...number': (a: f64, b: f64, rest: f64[]): f64 => Math.min(a, b, ...rest),

  // Parallel Float64Array min
  Float64Array: async (a: Float64Array): Promise<f64> => {
    const result = await computePool.min(a);
    return result.result;
  },
});

/**
 * Maximum of values with parallel array support
 */
export const max = mathTyped('max', {
  'bigint, bigint': (a: i64, b: i64): i64 => (a > b ? a : b),
  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => (a.compare(b) > 0 ? a : b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => (a.compare(b) > 0 ? a : b),
  Array: (arr: f64[]): f64 => Math.max(...arr),
  number: (a: f64): f64 => a,
  'number, number': (a: f64, b: f64): f64 => Math.max(a, b),
  'number, number, ...number': (a: f64, b: f64, rest: f64[]): f64 => Math.max(a, b, ...rest),

  // Parallel Float64Array max
  Float64Array: async (a: Float64Array): Promise<f64> => {
    const result = await computePool.max(a);
    return result.result;
  },
});

// =============================================================================
// Statistical Operations (Parallel-First)
// =============================================================================

/**
 * Sum with parallel array support
 */
export const sum = mathTyped('sum', {
  Array: (arr: f64[]): f64 => {
    let total: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      total += arr[i];
    }
    return total;
  },

  // Parallel Float64Array sum
  Float64Array: async (a: Float64Array): Promise<f64> => {
    const result = await computePool.sum(a);
    return result.result;
  },
});

/**
 * Mean with parallel array support
 */
export const mean = mathTyped('mean', {
  Array: (arr: f64[]): f64 => {
    if (arr.length === 0) return NaN;
    let total: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      total += arr[i];
    }
    return total / arr.length;
  },

  // Parallel Float64Array mean
  Float64Array: async (a: Float64Array): Promise<f64> => {
    const result = await computePool.mean(a);
    return result.result;
  },
});

/**
 * Variance with parallel array support
 */
export const variance = mathTyped('variance', {
  Array: (arr: f64[]): f64 => {
    if (arr.length === 0) return NaN;
    let m: f64 = 0;
    let m2: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      const delta: f64 = arr[i] - m;
      m += delta / (i + 1);
      const delta2: f64 = arr[i] - m;
      m2 += delta * delta2;
    }
    return m2 / arr.length;
  },

  // Parallel Float64Array variance
  Float64Array: async (a: Float64Array): Promise<f64> => {
    const result = await computePool.variance(a);
    return result.result.variance;
  },
});

/**
 * Standard deviation with parallel array support
 */
export const std = mathTyped('std', {
  Array: (arr: f64[]): f64 => {
    if (arr.length === 0) return NaN;
    let m: f64 = 0;
    let m2: f64 = 0;
    for (let i: i32 = 0; i < arr.length; i++) {
      const delta: f64 = arr[i] - m;
      m += delta / (i + 1);
      const delta2: f64 = arr[i] - m;
      m2 += delta * delta2;
    }
    return Math.sqrt(m2 / arr.length);
  },

  // Parallel Float64Array std
  Float64Array: async (a: Float64Array): Promise<f64> => {
    const result = await computePool.std(a);
    return result.result;
  },
});

/**
 * Dot product with parallel array support
 */
export const dot = mathTyped('dot', {
  'Array, Array': (a: f64[], b: f64[]): f64 => {
    if (a.length !== b.length) {
      throw new Error(`Vector lengths must match: ${a.length} vs ${b.length}`);
    }
    let total: f64 = 0;
    for (let i: i32 = 0; i < a.length; i++) {
      total += a[i] * b[i];
    }
    return total;
  },

  // Parallel Float64Array dot product
  'Float64Array, Float64Array': async (a: Float64Array, b: Float64Array): Promise<f64> => {
    const result = await computePool.dot(a, b);
    return result.result;
  },
});

// =============================================================================
// Matrix Operations (Parallel-First)
// =============================================================================

/**
 * Parallel matrix multiplication
 * @param a First matrix as flat Float64Array (row-major)
 * @param aRows Number of rows in A
 * @param aCols Number of columns in A (must equal bRows)
 * @param b Second matrix as flat Float64Array (row-major)
 * @param bCols Number of columns in B
 */
export async function matmul(
  a: Float64Array,
  aRows: i32,
  aCols: i32,
  b: Float64Array,
  bCols: i32
): Promise<Float64Array> {
  const result = await computePool.matmul(a, aRows, aCols, b, bCols);
  return result.result;
}

/**
 * Parallel matrix transpose
 */
export async function transpose(data: Float64Array, rows: i32, cols: i32): Promise<Float64Array> {
  const result = await computePool.transpose(data, rows, cols);
  return result.result;
}

/**
 * Parallel matrix-vector multiplication
 */
export async function matvec(
  matrix: Float64Array,
  rows: i32,
  cols: i32,
  vector: Float64Array
): Promise<Float64Array> {
  const result = await computePool.matvec(matrix, rows, cols, vector);
  return result.result;
}

/**
 * Parallel outer product
 */
export async function outer(a: Float64Array, b: Float64Array): Promise<Float64Array> {
  const result = await computePool.outer(a, b);
  return result.result;
}

// =============================================================================
// Pool Lifecycle Management
// =============================================================================

/**
 * Initialize the compute pool (call before using parallel operations)
 */
export async function initializePool(): Promise<void> {
  await computePool.initialize();
}

/**
 * Terminate the compute pool (call when done)
 */
export async function terminatePool(): Promise<void> {
  await computePool.terminate();
}

/**
 * Check if parallelization should be used for given element count
 */
export function shouldParallelize(elementCount: i32): boolean {
  return computePool.shouldParallelize(elementCount);
}

/**
 * Get the underlying ComputePool instance
 */
export function getComputePool(): ComputePool {
  return computePool;
}

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

  // Statistics
  sum,
  mean,
  variance,
  std,
  dot,

  // Matrix operations
  matmul,
  transpose,
  matvec,
  outer,

  // Lifecycle
  initializePool,
  terminatePool,
  shouldParallelize,
  getComputePool,
};
