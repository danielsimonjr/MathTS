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

import { mathTyped, Complex, Fraction, BigNumber, Dual } from '@danielsimonjr/mathts-core';
// The Unit is now the single merged class; use its instance type in type position.
import type { UnitInstance as Unit } from '@danielsimonjr/mathts-core';
import { DenseMatrix, backendManager, singularValues } from '@danielsimonjr/mathts-matrix';
import { MathJSDenseMatrix, MathJSSparseMatrix } from '../factories/matrix-bridge.js';

import { computePool, ComputePool } from '@danielsimonjr/mathts-parallel';
import { elementwiseUnaryDispatch } from '../wasm/elementwise/wasm-bridge.js';

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
// Element-wise Array / Matrix helpers
// =============================================================================

/** A scalar binary operation applied at the leaves of an element-wise walk. */
type ScalarOp = (x: unknown, y: unknown) => unknown;

/**
 * Recursively apply `op` element-wise over two nested-array operands. When one
 * operand is a scalar (non-array) it broadcasts against the other. Same-length
 * arrays are required at every level; a mismatch throws (mathjs parity).
 */
function elementwise(op: ScalarOp, a: unknown, b: unknown): unknown {
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr && bArr) {
    if (a.length !== b.length) {
      throw new RangeError(
        `Dimension mismatch (${a.length} != ${b.length}) in element-wise operation`
      );
    }
    return a.map((x, i) => elementwise(op, x, b[i]));
  }
  if (aArr) return a.map((x) => elementwise(op, x, b));
  if (bArr) return b.map((y) => elementwise(op, a, y));
  return op(a, b);
}

/** True if `m` is a matrix in sparse storage. */
function isSparseStorage(m: unknown): boolean {
  const s = (m as { storage?: () => string }).storage;
  return typeof s === 'function' && s.call(m) === 'sparse';
}

/** A matrix operand → its dense nested array; a scalar passes through unchanged. */
function toNested(m: unknown): unknown {
  const t = (m as { toArray?: () => unknown }).toArray;
  return typeof t === 'function' ? t.call(m) : m;
}

/**
 * Element-wise `op` over Matrix (and Matrix⊕scalar) operands, returning a bridge
 * matrix that preserves storage: sparse if either operand is sparse (CSC fields
 * intact, which the CSparse algebra factories rely on), otherwise dense.
 */
function elementwiseMatrix(
  op: ScalarOp,
  a: unknown,
  b: unknown
): MathJSDenseMatrix | MathJSSparseMatrix {
  const data = elementwise(op, toNested(a), toNested(b)) as unknown[][];
  return isSparseStorage(a) || isSparseStorage(b)
    ? new MathJSSparseMatrix(data)
    : new MathJSDenseMatrix(data as number[][]);
}

// Leaf operations for the element-wise walks above — deferred closures so they
// resolve the binary `add` / `multiply` at call time (after both are defined).
const addOp: ScalarOp = (x, y) => (add as unknown as ScalarOp)(x, y);
const mulOp: ScalarOp = (x, y) => (multiply as unknown as ScalarOp)(x, y);

// =============================================================================
// Unit operator helpers
// =============================================================================

/**
 * The Unit is now the single, core-relocated mathjs `Unit`
 * (`@danielsimonjr/mathts-core`) — the merge collapsed the former core/mathjs
 * duality, so `unit()`, `to()` and `toBest()` all return the SAME class. It keeps
 * add/subtract/comparison at the OPERATOR level and exposes `equalBase` /
 * normalized `value` / `clone` / `multiply` / `divide` / `abs`.
 */
interface UnitLike {
  value?: unknown;
  equalBase(other: unknown): boolean;
  clone(): UnitLike;
  multiply(other: unknown): unknown;
  divide(other: unknown): unknown;
  abs(): unknown;
}

const asUnit = (u: unknown): UnitLike => u as UnitLike;

/** Same-dimension test. */
function unitSameDimension(a: unknown, b: unknown): boolean {
  return asUnit(a).equalBase(b);
}

/** Comparison sign of two dimensionally-compatible units (throws if incompatible). */
function unitCmp(a: Unit, b: Unit): i32 {
  if (!unitSameDimension(a, b)) {
    throw new Error('Cannot compare units with different dimensions');
  }
  const va = asUnit(a).value as number;
  const vb = asUnit(b).value as number;
  return va > vb ? 1 : va < vb ? -1 : 0;
}

/**
 * Add/subtract: result carries the first operand's unit representation + the
 * combined normalized value.
 */
function unitAddSub(a: unknown, b: unknown, op: ScalarOp): unknown {
  const ua = asUnit(a);
  const ub = asUnit(b);
  if (!ua.equalBase(b)) {
    throw new Error('Cannot add/subtract units with different dimensions');
  }
  if (ua.value == null || ub.value == null) {
    throw new Error('Cannot add/subtract a valueless unit');
  }
  const res = ua.clone();
  res.value = op(ua.value, ub.value);
  return res;
}

const unitAdd = (a: unknown, b: unknown): unknown => unitAddSub(a, b, addOp);
const unitSub = (a: unknown, b: unknown): unknown => unitAddSub(a, b, (x, y) => subtract(x, y));
const unitMul = (a: unknown, b: unknown): unknown => asUnit(a).multiply(b);
const unitDiv = (a: unknown, b: unknown): unknown => asUnit(a).divide(b);

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

  // Unit arithmetic (mathjs parity): same-dimension units add (e.g. 5 cm + 3 mm).
  'Unit, Unit': (a: Unit, b: Unit): Unit => unitAdd(a, b) as Unit,

  // Dual numbers (forward-mode AD).
  'Dual, Dual': (a: Dual, b: Dual): Dual => a.add(b),
  'Dual, number': (a: Dual, b: f64): Dual => a.add(Dual.constant(b)),
  'number, Dual': (a: f64, b: Dual): Dual => Dual.constant(a).add(b),

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

  // Element-wise addition over plain (possibly nested / N-D) arrays, with scalar
  // broadcast. Leaves fold through the binary `add`, so number / Complex /
  // Fraction / BigNumber elements all work.
  'Array, Array': (a: unknown[], b: unknown[]): unknown => elementwise(addOp, a, b),
  'Array, number': (a: unknown[], b: f64): unknown => elementwise(addOp, a, b),
  'number, Array': (a: f64, b: unknown[]): unknown => elementwise(addOp, a, b),

  // Element-wise matrix addition (mathjs parity). Sparse⊕sparse stays sparse so
  // the CSparse algebra factories (csAmd's C = A + A', etc.) get CSC output.
  'DenseMatrix, DenseMatrix': (a: unknown, b: unknown): unknown => elementwiseMatrix(addOp, a, b),
  'SparseMatrix, SparseMatrix': (a: unknown, b: unknown): unknown => elementwiseMatrix(addOp, a, b),
  'DenseMatrix, number': (a: unknown, b: f64): unknown => elementwiseMatrix(addOp, a, b),
  'number, DenseMatrix': (a: f64, b: unknown): unknown => elementwiseMatrix(addOp, a, b),
  'SparseMatrix, number': (a: unknown, b: f64): unknown => elementwiseMatrix(addOp, a, b),
  'number, SparseMatrix': (a: f64, b: unknown): unknown => elementwiseMatrix(addOp, a, b),

  // Variadic addition over ANY types (mathjs parity). Folds pairwise through the
  // binary `add`, so Complex / Fraction / BigNumber / mixed arguments work — not
  // only number. (Needed e.g. by polynomialRoot's `add(b, C, …)` where C is a
  // complex cube root.) NOTE: this typed-function fork delivers the variadic
  // rest as a single packed array argument, not via JS spread.
  'any, any, ...any': (a: unknown, b: unknown, rest: unknown[]): unknown => {
    const op = add as unknown as (x: unknown, y: unknown) => unknown;
    let result = op(a, b);
    for (let i = 0; i < rest.length; i++) {
      result = op(result, rest[i]);
    }
    return result;
  },
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

  // Unit subtraction (same dimension): 5 cm − 3 mm.
  'Unit, Unit': (a: Unit, b: Unit): Unit => unitSub(a, b) as Unit,

  // Dual numbers (forward-mode AD).
  'Dual, Dual': (a: Dual, b: Dual): Dual => a.sub(b),
  'Dual, number': (a: Dual, b: f64): Dual => a.sub(Dual.constant(b)),
  'number, Dual': (a: f64, b: Dual): Dual => Dual.constant(a).sub(b),

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

  // Unit multiplication / scaling (mathjs parity).
  'Unit, Unit': (a: Unit, b: Unit): Unit => unitMul(a, b) as Unit,
  'Unit, number': (a: Unit, b: f64): Unit => unitMul(a, b) as Unit,
  'number, Unit': (a: f64, b: Unit): Unit => unitMul(b, a) as Unit,

  // Dual numbers (forward-mode AD).
  'Dual, Dual': (a: Dual, b: Dual): Dual => a.mul(b),
  'Dual, number': (a: Dual, b: f64): Dual => a.mul(Dual.constant(b)),
  'number, Dual': (a: f64, b: Dual): Dual => Dual.constant(a).mul(b),

  // Matrix × matrix (2-D arrays) routed through the native DenseMatrix +
  // BackendManager — i.e. WASM/GPU acceleration for large matrices (GC7).
  // Previously `multiply(2DArray, 2DArray)` threw; this is additive. Non-2-D
  // Array operands throw a clear message pointing at the right primitive.
  'Array, Array': (a: unknown[], b: unknown[]): number[][] => {
    if (!Array.isArray(a[0]) || !Array.isArray(b[0])) {
      throw new TypeError(
        'multiply(Array, Array) requires two 2-D matrices; use dot() for vector dot products'
      );
    }
    const A = DenseMatrix.fromArray(a as number[][]);
    const B = DenseMatrix.fromArray(b as number[][]);
    return backendManager.multiply(A, B).toArray();
  },

  // Matrix × matrix on boxed matrices returns a boxed matrix (mathjs parity) —
  // NOT a bare array. The `Array, Array` path above returns an array, and
  // reaching it via the Matrix~>Array conversion would strip the matrix type
  // (breaking callers like `sylvester` that call `.toArray()` on the product).
  'DenseMatrix, DenseMatrix': (a: unknown, b: unknown): unknown => {
    const A = DenseMatrix.fromArray((a as { toArray(): number[][] }).toArray());
    const B = DenseMatrix.fromArray((b as { toArray(): number[][] }).toArray());
    return new MathJSDenseMatrix(backendManager.multiply(A, B).toArray());
  },

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

  // Scalar × collection = element-wise scaling (mathjs parity). Matrix × matrix
  // stays matrix multiplication — the `Array, Array` matmul above (reached for
  // Matrix operands via the Matrix~>Array conversion); element-wise product of
  // two collections is `dotMultiply`.
  'Array, number': (a: unknown[], b: f64): unknown => elementwise(mulOp, a, b),
  'number, Array': (a: f64, b: unknown[]): unknown => elementwise(mulOp, a, b),
  'DenseMatrix, number': (a: unknown, b: f64): unknown => elementwiseMatrix(mulOp, a, b),
  'number, DenseMatrix': (a: f64, b: unknown): unknown => elementwiseMatrix(mulOp, a, b),
  'SparseMatrix, number': (a: unknown, b: f64): unknown => elementwiseMatrix(mulOp, a, b),
  'number, SparseMatrix': (a: f64, b: unknown): unknown => elementwiseMatrix(mulOp, a, b),

  // Variadic multiplication over ANY types (mathjs parity); folds pairwise
  // through the binary `multiply`. See the variadic-add note above re: types and
  // the packed-array rest shape.
  'any, any, ...any': (a: unknown, b: unknown, rest: unknown[]): unknown => {
    const op = multiply as unknown as (x: unknown, y: unknown) => unknown;
    let result = op(a, b);
    for (let i = 0; i < rest.length; i++) {
      result = op(result, rest[i]);
    }
    return result;
  },
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

  // Unit division / scaling (mathjs parity). Unit ÷ Unit may be dimensionless.
  'Unit, Unit': (a: Unit, b: Unit): Unit => unitDiv(a, b) as Unit,
  'Unit, number': (a: Unit, b: f64): Unit => unitDiv(a, b) as Unit,

  // Dual numbers (forward-mode AD).
  'Dual, Dual': (a: Dual, b: Dual): Dual => a.div(b),
  'Dual, number': (a: Dual, b: f64): Dual => a.div(Dual.constant(b)),
  'number, Dual': (a: f64, b: Dual): Dual => Dual.constant(a).div(b),

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
  Dual: (a: Dual): Dual => a.abs(),
  Unit: (a: Unit): Unit => asUnit(a).abs() as unknown as Unit,

  // Parallel array abs
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    const wasm = elementwiseUnaryDispatch('abs', a);
    if (wasm) return wasm;
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
  // sign(z) = z/|z| (unit-modulus complex); sign(0) = 0 (mathjs parity).
  Complex: (a: Complex): Complex => {
    const m = Math.hypot(a.re, a.im);
    return m === 0 ? new Complex(0, 0) : new Complex(a.re / m, a.im / m);
  },

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
  // Dual numbers (forward-mode AD): constant or variable exponent.
  'Dual, number': (a: Dual, b: f64): Dual => a.powConst(b),
  'Dual, Dual': (a: Dual, b: Dual): Dual => a.pow(b),

  // Matrix power A^n for a square 2-D array and non-negative integer n, via binary
  // exponentiation on the native DenseMatrix backend (accelerated matmul, B2). Element-
  // wise power is `dotPow`; negative/fractional matrix powers need eigendecomposition —
  // use the async `matrixPower(A, p)`.
  'Array, number': (a: unknown[], b: f64): number[][] => {
    if (!Array.isArray(a[0])) {
      throw new TypeError(
        'pow(Array, number): expected a square 2-D matrix; use dotPow for element-wise power'
      );
    }
    const m = a as number[][];
    const n = m.length;
    if (m.some((row) => row.length !== n)) {
      throw new RangeError(`pow: matrix must be square (got ${n}×${m[0]?.length ?? 0})`);
    }
    if (!Number.isInteger(b) || b < 0) {
      throw new Error(
        'pow: only non-negative integer exponents are supported for matrices here; ' +
          'use matrixPower(A, p) for negative or fractional powers'
      );
    }
    let result = DenseMatrix.identity(n);
    let base = DenseMatrix.fromArray(m);
    let e = b;
    while (e > 0) {
      if (e % 2 === 1) result = backendManager.multiply(result, base);
      e = Math.floor(e / 2);
      if (e > 0) base = backendManager.multiply(base, base);
    }
    return result.toArray();
  },
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
  Dual: (a: Dual): Dual => a.sqrt(),

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
  Dual: (a: Dual): Dual => a.square(),

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
  Dual: (a: Dual): Dual => a.powConst(3),

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
 * The three complex cube roots of `z`, principal first: |z|^(1/3)·e^(i·arg/3)
 * rotated by 0, +2π/3, −2π/3. Matches mathjs `cbrt(x, true)` ordering.
 */
function cbrtAllRoots(z: Complex): Complex[] {
  const arg3 = z.arg() / 3;
  const r = Math.cbrt(z.abs());
  const rotate = (theta: number): Complex => new Complex(r, 0).mul(new Complex(0, theta).exp());
  return [rotate(arg3), rotate(arg3 + (Math.PI * 2) / 3), rotate(arg3 - (Math.PI * 2) / 3)];
}

/**
 * Cube root
 */
export const cbrt = mathTyped('cbrt', {
  number: (a: f64): f64 => Math.cbrt(a),
  Complex: (a: Complex): Complex => a.pow(1 / 3),
  BigNumber: (a: BigNumber): BigNumber => a.cbrt(),
  Dual: (a: Dual): Dual => a.powConst(1 / 3),

  // Two-argument allRoots forms (mathjs parity). When `allRoots` is true, all
  // three complex cube roots are returned (principal first); otherwise the
  // principal complex root. The real `number` case routes through the complex
  // path exactly like mathjs `cbrt(8, true)` → [2, -1±i√3].
  'number, boolean': (a: f64, allRoots: boolean): Complex | Complex[] => {
    const z = new Complex(a, 0);
    return allRoots ? cbrtAllRoots(z) : cbrtAllRoots(z)[0];
  },
  'Complex, boolean': (a: Complex, allRoots: boolean): Complex | Complex[] => {
    return allRoots ? cbrtAllRoots(a) : cbrtAllRoots(a)[0];
  },

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
  Dual: (a: Dual): Dual => a.exp(),

  // Parallel array exp
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    const wasm = elementwiseUnaryDispatch('exp', a);
    if (wasm) return wasm;
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
  Dual: (a: Dual): Dual => a.log(),
  'number, number': (a: f64, base: f64): f64 => Math.log(a) / Math.log(base),

  // Parallel array log
  Float64Array: async (a: Float64Array): Promise<Float64Array> => {
    const wasm = elementwiseUnaryDispatch('log', a);
    if (wasm) return wasm;
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
    const wasm = elementwiseUnaryDispatch('log10', a);
    if (wasm) return wasm;
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
    const wasm = elementwiseUnaryDispatch('log2', a);
    if (wasm) return wasm;
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
    const wasm = elementwiseUnaryDispatch('log1p', a);
    if (wasm) return wasm;
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
    const wasm = elementwiseUnaryDispatch('expm1', a);
    if (wasm) return wasm;
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
  Complex: (a: Complex): Complex => new Complex(Math.round(a.re), Math.round(a.im)),
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
  Complex: (a: Complex): Complex => new Complex(Math.floor(a.re), Math.floor(a.im)),

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
  Complex: (a: Complex): Complex => new Complex(Math.ceil(a.re), Math.ceil(a.im)),

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
  Complex: (a: Complex): Complex => new Complex(Math.trunc(a.re), Math.trunc(a.im)),

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
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => {
    let x = a.abs();
    let y = b.abs();
    while (!y.isZero()) {
      const t = y;
      y = x.mod(y);
      x = t;
    }
    return x;
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
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => {
    const g = gcd(a, b) as BigNumber;
    if (g.isZero()) return BigNumber.fromNumber(0);
    return a.abs().multiply(b.abs()).divide(g);
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
/** Is `arr` a 2-D (matrix) array rather than a flat vector? */
function is2DArray(arr: unknown[]): boolean {
  return Array.isArray(arr[0]);
}

/** Vector p-norm (`p` defaults to 2). */
function vectorNorm(arr: f64[], p: f64 = 2): f64 {
  if (p === Infinity) return Math.max(...arr.map((x) => Math.abs(x)));
  if (p === -Infinity) return Math.min(...arr.map((x) => Math.abs(x)));
  if (p === 0) return arr.filter((x) => x !== 0).length;
  if (p === 2) return Math.sqrt(arr.reduce((sum, x) => sum + x * x, 0));
  return Math.pow(
    arr.reduce((sum, x) => sum + Math.pow(Math.abs(x), p), 0),
    1 / p
  );
}

/**
 * Matrix norm of a 2-D array. Supports Frobenius (`'fro'`/`'frobenius'`, the
 * default), the max-column-sum 1-norm, the max-row-sum ∞-norm, and the spectral
 * 2-norm (largest singular value). Previously the typed `norm` had no matrix
 * path, so `norm(matrix, 2)` returned `null` and `norm(matrix, 'fro')` threw.
 */
function matrixNorm(data: f64[][], p: f64 | string = 'fro'): f64 {
  const rows = data.length;
  const cols = rows > 0 ? data[0].length : 0;
  if (p === 'fro' || p === 'frobenius') {
    let s = 0;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) s += data[i][j] * data[i][j];
    return Math.sqrt(s);
  }
  if (p === 1) {
    let max = 0;
    for (let j = 0; j < cols; j++) {
      let s = 0;
      for (let i = 0; i < rows; i++) s += Math.abs(data[i][j]);
      if (s > max) max = s;
    }
    return max;
  }
  if (p === Infinity) {
    let max = 0;
    for (let i = 0; i < rows; i++) {
      let s = 0;
      for (let j = 0; j < cols; j++) s += Math.abs(data[i][j]);
      if (s > max) max = s;
    }
    return max;
  }
  if (p === 2) {
    // spectral norm = largest singular value
    const sv = singularValues(data);
    return sv.length > 0 ? Math.max(...sv) : 0;
  }
  throw new Error(`Unsupported matrix norm p=${String(p)} (use 'fro', 1, 2, or Infinity)`);
}

const matrixLike = (m: { toArray(): unknown }): f64[][] => m.toArray() as f64[][];

export const norm = mathTyped('norm', {
  number: (a: f64): f64 => Math.abs(a),
  Complex: (a: Complex): f64 => a.abs(),
  BigNumber: (a: BigNumber): BigNumber => a.abs(),

  // Array: a flat vector uses the vector 2-norm; a 2-D array is a matrix (Frobenius).
  Array: (arr: unknown[]): f64 =>
    is2DArray(arr) ? matrixNorm(arr as f64[][]) : vectorNorm(arr as f64[]),
  'Array, number': (arr: unknown[], p: f64): f64 =>
    is2DArray(arr) ? matrixNorm(arr as f64[][], p) : vectorNorm(arr as f64[], p),
  'Array, string': (arr: unknown[], p: string): f64 => matrixNorm(arr as f64[][], p),

  // Matrix norms (mathjs parity): Frobenius / 1 / 2 / ∞.
  DenseMatrix: (m: unknown): f64 => matrixNorm(matrixLike(m as { toArray(): unknown })),
  'DenseMatrix, number': (m: unknown, p: f64): f64 =>
    matrixNorm(matrixLike(m as { toArray(): unknown }), p),
  'DenseMatrix, string': (m: unknown, p: string): f64 =>
    matrixNorm(matrixLike(m as { toArray(): unknown }), p),
  SparseMatrix: (m: unknown): f64 => matrixNorm(matrixLike(m as { toArray(): unknown })),
  'SparseMatrix, number': (m: unknown, p: f64): f64 =>
    matrixNorm(matrixLike(m as { toArray(): unknown }), p),
  'SparseMatrix, string': (m: unknown, p: string): f64 =>
    matrixNorm(matrixLike(m as { toArray(): unknown }), p),

  // Float64Array norm (Euclidean) — gated on the (memory-bound ⇒ 'never') threshold.
  // Previously dispatched to the worker pool unconditionally, ignoring the 'never'
  // config; now sequential unless the threshold says otherwise.
  Float64Array: async (a: Float64Array): Promise<f64> => {
    if (computePool.shouldParallelize(a.length, 'norm')) {
      return (await computePool.norm(a)).result;
    }
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * a[i];
    return Math.sqrt(s);
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
    const wasm = elementwiseUnaryDispatch('sinh', a);
    if (wasm) return wasm;
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
    const wasm = elementwiseUnaryDispatch('tanh', a);
    if (wasm) return wasm;
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
// Unit comparison (mathjs parity): order by base-unit value once dimensions
// match. Ordering across incompatible dimensions is an error; equality across
// them is simply false.
export const equal = mathTyped('equal', {
  'number, number': (a: f64, b: f64): boolean => a === b,
  'bigint, bigint': (a: i64, b: i64): boolean => a === b,
  'Complex, Complex': (a: Complex, b: Complex): boolean => a.equals(b),
  'Fraction, Fraction': (a: Fraction, b: Fraction): boolean => a.equals(b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean => a.equals(b),
  'Unit, Unit': (a: Unit, b: Unit): boolean =>
    unitSameDimension(a, b) && asUnit(a).value === asUnit(b).value,
});

/**
 * Check if a < b
 */
export const smaller = mathTyped('smaller', {
  'number, number': (a: f64, b: f64): boolean => a < b,
  'bigint, bigint': (a: i64, b: i64): boolean => a < b,
  'Fraction, Fraction': (a: Fraction, b: Fraction): boolean => a.compare(b) < 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean => a.compare(b) < 0,
  'Unit, Unit': (a: Unit, b: Unit): boolean => unitCmp(a, b) < 0,
});

/**
 * Check if a > b
 */
export const larger = mathTyped('larger', {
  'number, number': (a: f64, b: f64): boolean => a > b,
  'bigint, bigint': (a: i64, b: i64): boolean => a > b,
  'Fraction, Fraction': (a: Fraction, b: Fraction): boolean => a.compare(b) > 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean => a.compare(b) > 0,
  'Unit, Unit': (a: Unit, b: Unit): boolean => unitCmp(a, b) > 0,
});

/**
 * Check if a <= b
 */
export const smallerEq = mathTyped('smallerEq', {
  'number, number': (a: f64, b: f64): boolean => a <= b,
  'bigint, bigint': (a: i64, b: i64): boolean => a <= b,
  'Fraction, Fraction': (a: Fraction, b: Fraction): boolean => a.compare(b) <= 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean => a.compare(b) <= 0,
  'Unit, Unit': (a: Unit, b: Unit): boolean => unitCmp(a, b) <= 0,
});

/**
 * Check if a >= b
 */
export const largerEq = mathTyped('largerEq', {
  'number, number': (a: f64, b: f64): boolean => a >= b,
  'bigint, bigint': (a: i64, b: i64): boolean => a >= b,
  'Fraction, Fraction': (a: Fraction, b: Fraction): boolean => a.compare(b) >= 0,
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean => a.compare(b) >= 0,
  'Unit, Unit': (a: Unit, b: Unit): boolean => unitCmp(a, b) >= 0,
});

/**
 * Compare two values: -1, 0, or 1
 */
export const compare = mathTyped('compare', {
  'number, number': (a: f64, b: f64): i32 => (a > b ? 1 : a < b ? -1 : 0),
  'bigint, bigint': (a: i64, b: i64): i32 => (a > b ? 1 : a < b ? -1 : 0),
  'Fraction, Fraction': (a: Fraction, b: Fraction): i32 => a.compare(b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): i32 => a.compare(b),
  'Unit, Unit': (a: Unit, b: Unit): i32 => unitCmp(a, b),
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

  // Float64Array min — gated on the (memory-bound ⇒ 'never') threshold, so it stays
  // sequential instead of paying worker-dispatch overhead on every call.
  Float64Array: async (a: Float64Array): Promise<f64> => {
    if (computePool.shouldParallelize(a.length, 'min')) {
      return (await computePool.min(a)).result;
    }
    let m = Infinity;
    for (let i = 0; i < a.length; i++) if (a[i] < m) m = a[i];
    return m;
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

  // Float64Array max — gated on the (memory-bound ⇒ 'never') threshold; sequential.
  Float64Array: async (a: Float64Array): Promise<f64> => {
    if (computePool.shouldParallelize(a.length, 'max')) {
      return (await computePool.max(a)).result;
    }
    let m = -Infinity;
    for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
    return m;
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
 * Variance normalization, matching mathjs's `variance(array, normalization)`:
 *   - 'unbiased'    → sum2 / (n - 1)   (sample variance; mathjs DEFAULT)
 *   - 'uncorrected' → sum2 / n         (population variance)
 *   - 'biased'      → sum2 / (n + 1)
 */
export type VarNormalization = 'unbiased' | 'uncorrected' | 'biased';

/** Sum of squared deviations from the mean (Welford), then normalized. */
function varianceFromM2(m2: f64, n: i32, norm: VarNormalization): f64 {
  if (n === 0) return NaN;
  switch (norm) {
    case 'biased':
      return m2 / (n + 1);
    case 'uncorrected':
      return m2 / n;
    case 'unbiased':
    default:
      // mathjs returns 0 (not NaN) for a single value under unbiased.
      return n > 1 ? m2 / (n - 1) : 0;
  }
}

function m2OfArray(arr: f64[]): f64 {
  let m: f64 = 0;
  let m2: f64 = 0;
  for (let i: i32 = 0; i < arr.length; i++) {
    const delta: f64 = arr[i] - m;
    m += delta / (i + 1);
    const delta2: f64 = arr[i] - m;
    m2 += delta * delta2;
  }
  return m2;
}

/**
 * Variance with parallel array support.
 *
 * Defaults to **unbiased** (sample, ÷(n-1)) to match mathjs and the
 * `parallelStatVariance` variant. An optional normalization argument selects
 * 'unbiased' | 'uncorrected' (population) | 'biased'. See VarNormalization.
 */
export const variance = mathTyped('variance', {
  Array: (arr: f64[]): f64 => varianceFromM2(m2OfArray(arr), arr.length, 'unbiased'),
  'Array, string': (arr: f64[], norm: string): f64 =>
    varianceFromM2(m2OfArray(arr), arr.length, norm as VarNormalization),

  // Parallel Float64Array variance. computePool returns POPULATION variance
  // (sum2/n); recover sum2 = pop·n and renormalize for the requested convention.
  Float64Array: async (a: Float64Array): Promise<f64> => {
    const result = await computePool.variance(a);
    return varianceFromM2(result.result.variance * a.length, a.length, 'unbiased');
  },
  'Float64Array, string': async (a: Float64Array, norm: string): Promise<f64> => {
    const result = await computePool.variance(a);
    return varianceFromM2(result.result.variance * a.length, a.length, norm as VarNormalization);
  },
});

/**
 * Standard deviation with parallel array support — sqrt of {@link variance};
 * defaults to **unbiased** and accepts the same normalization argument.
 */
export const std = mathTyped('std', {
  Array: (arr: f64[]): f64 => Math.sqrt(varianceFromM2(m2OfArray(arr), arr.length, 'unbiased')),
  'Array, string': (arr: f64[], norm: string): f64 =>
    Math.sqrt(varianceFromM2(m2OfArray(arr), arr.length, norm as VarNormalization)),

  // Parallel Float64Array std — derive from the (renormalized) variance so the
  // convention matches the Array path and parallelStatStd.
  Float64Array: async (a: Float64Array): Promise<f64> => {
    const result = await computePool.variance(a);
    return Math.sqrt(varianceFromM2(result.result.variance * a.length, a.length, 'unbiased'));
  },
  'Float64Array, string': async (a: Float64Array, norm: string): Promise<f64> => {
    const result = await computePool.variance(a);
    return Math.sqrt(
      varianceFromM2(result.result.variance * a.length, a.length, norm as VarNormalization)
    );
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
