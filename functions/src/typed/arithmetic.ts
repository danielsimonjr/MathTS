/**
 * Typed Arithmetic Functions
 *
 * Polymorphic arithmetic operations using typed-function for runtime dispatch.
 * Supports Complex, Fraction, BigNumber, and Float64Array types.
 *
 * Every typed-function signature in this file is synchronous. Each Float64Array signature
 * returns a Float64Array (element-wise ops) or a number (reductions), not a Promise.
 * The standalone helpers matmul, transpose, matvec and outer are synchronous too. Some unary
 * ops use the WASM tier first after `loadWasm()` loads the tier.
 * For worker threads, use `ComputePool` or
 * `parallelMap` from `@danielsimonjr/mathts-parallel`.
 *
 * @packageDocumentation
 */

import { assertRectangular, isNumberMatrix, numberVector } from './number-matrix.js';
import { factoryScope } from '../factories/scope.js';
import {
  mathTyped,
  Complex,
  Fraction,
  BigNumber,
  Dual,
  DimensionMismatchError,
  extrema,
} from '@danielsimonjr/mathts-core';
import { euclidSnap } from './euclid.js';
import { f64Unary, f64UnaryDispatched, mapEachLeaf, unaryCollection } from './f64-kernels.js';
import {
  pairwiseSum,
  pairwiseSumChecked,
  neumaierSum,
  norm2,
  pairwiseDot,
  pairwiseDotChecked,
  sumSquaredDeviations,
  sumSquaredDeviationsChecked,
} from '@danielsimonjr/mathts-core';
import {
  finiteNumbers,
  normalizationFromSecondArg,
  normalizationFromStringAndOptions,
  reduceNumericMatrix,
  type StatReduceOptions,
  type NumericVectorInput,
  type VarianceRequest,
} from '../statistics/numeric-data.js';
// Bucket-C "temperature split": rich-type (BigNumber/Fraction/Complex) POLICY cases
// delegate to core's oracle-pinned scalar primitives instead of re-implementing the
// policy here (where the copies had DIVERGED into three live bugs). Hot number/bigint
// cases stay inline below. A BigNumber method call dwarfs this cross-module call, so
// the delegation is perf-free (see the microbench in the dedup equivalence test).
import {
  pow as corePow,
  round as coreRound,
  fix as coreFix,
  equal as coreEqual,
} from '@danielsimonjr/mathts-core';
// The Unit is now the single merged class; use its instance type in type position.
import type { UnitInstance as Unit, TypedFunction } from '@danielsimonjr/mathts-core';
import {
  DenseMatrix,
  SparseMatrix,
  backendManager,
  isDenseMatrix,
  isSparseMatrix,
  singularValues,
} from '@danielsimonjr/mathts-matrix';
import { MathJSDenseMatrix, MathJSSparseMatrix } from '../factories/matrix-bridge.js';

import { computePool, ComputePool, matmulSequential } from '@danielsimonjr/mathts-parallel';
import { withBinaryScalarGuards } from './invalid-scalar-guards.js';
import { atWorkPrecision } from '../utils/bignumber/work-precision.js';
import { divideInverse } from './divide-inverse.js';
import { exactReductions } from './exact-reductions.js';
import {
  ROUND_DECIMALS_NOT_INTEGER,
  roundBigNumberDecimals,
} from '../utils/bignumber/round-decimals.js';
import type {
  PublicAbs,
  PublicAdd,
  PublicExp,
  PublicLog,
  PublicLog10,
  PublicMean,
  PublicSqrt,
  PublicStd,
  PublicVariance,
} from './public-type-exports.js';
import {
  logReal,
  logRealBase,
  log10Real,
  log2Real,
  log1pReal,
  staysRealLog,
  staysRealLog1p,
  isPredictableMode,
  sqrtBigNumberWith,
  powBigNumberWith,
  logBigNumberWith,
  log1pBigNumberWith,
  liveConfig,
  sqrtReal,
  staysRealSqrt,
  powReal,
  nthRootReal,
} from './complex-promotion.js';

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

type NumberBin = (a: number, b: number) => number;
const numberBinCache = new WeakMap<object, NumberBin>();

/**
 * Apply `f` element by element to two Float64Arrays of the same length.
 * The result is a new array; the inputs do not change. A length mismatch throws.
 */
function f64Binary(a: Float64Array, b: Float64Array, f: NumberBin): Float64Array {
  if (a.length !== b.length) {
    throw new RangeError(
      `Dimension mismatch (${a.length} != ${b.length}) in element-wise operation`
    );
  }
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = f(a[i], b[i]);
  return out;
}

function getNumberBin(tf: object, fallback: ScalarOp): NumberBin {
  let f = numberBinCache.get(tf);
  if (!f) {
    let found: NumberBin | null = null;
    try {
      found = mathTyped.find(tf as Parameters<typeof mathTyped.find>[0], [
        'number',
        'number',
      ]) as NumberBin;
    } catch {
      found = null;
    }
    f = found ?? ((a, b) => fallback(a, b) as number);
    numberBinCache.set(tf, f);
  }
  return f;
}

function arrayAllNumbersFlat(a: unknown[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (typeof a[i] !== 'number') return false;
  }
  return true;
}

function arrayAllNumbersPair(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (typeof a[i] !== 'number' || typeof b[i] !== 'number') return false;
  }
  return true;
}

function elementwiseNumber(tf: object, fallback: ScalarOp, a: unknown, b: unknown): unknown {
  const f = getNumberBin(tf, fallback);
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr && bArr) {
    if (a.length !== b.length) {
      throw new RangeError(
        `Dimension mismatch (${a.length} != ${b.length}) in element-wise operation`
      );
    }
    if (a.constructor !== Array || b.constructor !== Array) {
      return elementwise(fallback, a, b);
    }
    if (a.length > 0 && (Array.isArray(a[0]) || Array.isArray(b[0]))) {
      const out = new Array(a.length);
      for (let i = 0; i < a.length; i++) {
        out[i] = elementwiseNumber(tf, fallback, a[i], b[i]);
      }
      return out;
    }
    if (arrayAllNumbersPair(a, b)) {
      const n = a.length;
      const out = new Array(n);
      for (let i = 0; i < n; i++) out[i] = f(a[i] as number, b[i] as number);
      return out;
    }
    return elementwise(fallback, a, b);
  }
  if (aArr) {
    if (a.constructor !== Array || typeof b !== 'number') {
      return elementwise(fallback, a, b);
    }
    if (a.length > 0 && Array.isArray(a[0])) {
      return a.map((x) => elementwiseNumber(tf, fallback, x, b));
    }
    if (arrayAllNumbersFlat(a)) {
      const out = new Array(a.length);
      for (let i = 0; i < a.length; i++) out[i] = f(a[i] as number, b as number);
      return out;
    }
    return elementwise(fallback, a, b);
  }
  if (bArr) {
    if (b.constructor !== Array || typeof a !== 'number') {
      return elementwise(fallback, a, b);
    }
    if (b.length > 0 && Array.isArray(b[0])) {
      return b.map((y) => elementwiseNumber(tf, fallback, a, y));
    }
    if (arrayAllNumbersFlat(b)) {
      const out = new Array(b.length);
      for (let i = 0; i < b.length; i++) out[i] = f(a as number, b[i] as number);
      return out;
    }
    return elementwise(fallback, a, b);
  }
  return fallback(a, b);
}

/**
 * Element-wise operation on matrix operands. The result storage follows mathjs: two sparse
 * operands give a sparse result; a sparse operand with a number gives a sparse result when
 * `scalarKeepsSparse` is true (multiply, divide: a zero stays zero; `mod` takes 'left': mathjs gives a sparse result when the first operand is sparse) and a dense result
 * otherwise (add, subtract: a zero becomes the number); a sparse operand with a dense one
 * gives a dense result. A call with a public CSR `SparseMatrix` returns the public class,
 * which stores numbers only; a result with another entry type stays a dense matrix.
 */
function elementwiseMatrixNumber(
  tf: object,
  fallback: ScalarOp,
  a: unknown,
  b: unknown,
  scalarKeepsSparse: boolean | 'left' = false
): MathJSDenseMatrix | MathJSSparseMatrix | SparseMatrix {
  const data = elementwiseNumber(tf, fallback, toNested(a), toNested(b)) as unknown[][];
  const sparseA = isSparseStorage(a);
  const sparseB = isSparseStorage(b);
  const sparseOut =
    (sparseA && sparseB) ||
    (scalarKeepsSparse === 'left' && sparseA) ||
    (scalarKeepsSparse === true &&
      ((sparseA && !isCollection(b)) || (sparseB && !isCollection(a))));
  if (!sparseOut) return new MathJSDenseMatrix(data as number[][]);
  if (isSparseMatrix(a) || isSparseMatrix(b)) return publicSparseOrDense(data);
  return new MathJSSparseMatrix(data);
}

/** The public `SparseMatrix` of nested numbers; a nested array with another entry type as a dense matrix. */
function publicSparseOrDense(data: unknown[][]): SparseMatrix | MathJSDenseMatrix {
  for (const row of data) {
    for (const v of row) {
      if (typeof v !== 'number') return new MathJSDenseMatrix(data as number[][]);
    }
  }
  return SparseMatrix.fromDense(DenseMatrix.fromArray(data as number[][]));
}

/** True for an Array or a matrix; false for a scalar of any type. */
function isCollection(x: unknown): boolean {
  return Array.isArray(x) || typeof (x as { toArray?: unknown } | null)?.toArray === 'function';
}

/** True if `m` is a matrix in sparse storage (the public CSR class or the factory CSC class). */
function isSparseStorage(m: unknown): boolean {
  if (isSparseMatrix(m)) return true;
  const s = (m as { storage?: () => string }).storage;
  return typeof s === 'function' && s.call(m) === 'sparse';
}

/** The product of two matrix operands of any storage, as nested numbers. */
function matrixProduct(a: unknown, b: unknown): unknown[][] {
  const na = toNested(a) as unknown[][];
  const nb = toNested(b) as unknown[][];
  // The numeric backend holds numbers only. A Complex, Fraction or BigNumber entry takes the
  // generic product, which uses the scalar add and multiply (#1040).
  if (!isNumberMatrix(na) || !isNumberMatrix(nb)) {
    assertRectangular(na);
    assertRectangular(nb);
    return genericMatrixProduct(na, nb);
  }
  const A = DenseMatrix.fromArray(na as number[][]);
  const B = DenseMatrix.fromArray(nb as number[][]);
  return backendManager.multiply(A, B).toArray();
}

/** The product of two 2-D arrays with any scalar entries, by the scalar add and multiply. */
function genericMatrixProduct(a: unknown[][], b: unknown[][]): unknown[][] {
  const rows = a.length;
  const inner = rows > 0 ? a[0].length : 0;
  const cols = b.length > 0 ? b[0].length : 0;
  if (b.length !== inner) {
    throw new Error(`Cannot multiply ${rows}×${inner} matrix with ${b.length}×${cols} matrix`);
  }
  const out: unknown[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: unknown[] = [];
    for (let j = 0; j < cols; j++) {
      let acc: unknown = mulOp(a[i][0], b[0][j]);
      for (let k = 1; k < inner; k++) acc = addOp(acc, mulOp(a[i][k], b[k][j]));
      row.push(acc);
    }
    out.push(row);
  }
  return out;
}

/** A matrix operand → its dense nested array; a scalar passes through unchanged. */
function toNested(m: unknown): unknown {
  const t = (m as { toArray?: () => unknown }).toArray;
  return typeof t === 'function' ? t.call(m) : m;
}

// Leaf operations for the element-wise walks above — deferred closures so they
// resolve the binary `add` / `subtract` / `multiply` at call time (after all are defined).
const addOp: ScalarOp = (x, y) => (add as unknown as ScalarOp)(x, y);
const subOp: ScalarOp = (x, y) => (subtract as unknown as ScalarOp)(x, y);
const mulOp: ScalarOp = (x, y) => (multiply as unknown as ScalarOp)(x, y);

const addForNumberPath: { fn?: object } = {};
const subtractForNumberPath: { fn?: object } = {};
const multiplyForNumberPath: { fn?: object } = {};
const divideForNumberPath: { fn?: object } = {};
const divOp: ScalarOp = (x, y) => (divide as unknown as ScalarOp)(x, y);
const modForNumberPath: { fn?: object } = {};
const modOp: ScalarOp = (x, y) => (mod as unknown as ScalarOp)(x, y);

// =============================================================================
// Scalar x collection signatures
// =============================================================================

/**
 * The scalar types, other than `number`, that combine with a collection. They go through the
 * element-wise walk, whose leaves fold through the binary operation (so a `Unit` keeps its
 * dimension check, and a `Complex`, `Fraction` or `BigNumber` keeps its type). `number` keeps
 * the rows that each function writes out (`gen-public-overloads` reads the public overloads of
 * `add` from those source rows, and it cannot read rows that a helper builds).
 */
const OTHER_SCALAR_TYPES = ['Unit', 'Complex', 'Fraction', 'BigNumber'] as const;
const ALL_SCALAR_TYPES = ['number', ...OTHER_SCALAR_TYPES] as const;
const COLLECTION_TYPES = ['Array', 'DenseMatrix', 'SparseMatrix'] as const;

type CollectionKernel = (a: unknown, b: unknown) => unknown;

/** What an operation runs for an Array operand, and for a matrix operand of either storage. */
interface CollectionKernels {
  array: CollectionKernel;
  matrix: CollectionKernel;
}

/**
 * The kernels of an operation that applies to each element. `path.fn` is the public typed
 * function (it holds the `number, number` row of the fast path) and `leaf` is the same
 * operation for any pair of scalars. Both are read at call time, after all are defined.
 */
function elementwiseKernels(
  path: { fn?: object },
  leaf: ScalarOp,
  scalarKeepsSparse: boolean | 'left' = false
): CollectionKernels {
  return {
    array: (a, b) => elementwiseNumber(path.fn!, leaf, a, b),
    matrix: (a, b) => elementwiseMatrixNumber(path.fn!, leaf, a, b, scalarKeepsSparse),
  };
}

/**
 * Signatures `<scalar>, <collection>` (from `scalarFirst`) and `<collection>, <scalar>`
 * (from `collectionFirst`) for each of `scalars` and each collection of
 * {@link COLLECTION_TYPES}. `add`, `subtract` and `multiply` pass the same kernels for both
 * orders and the scalars of {@link OTHER_SCALAR_TYPES}; `divide` passes
 * {@link ALL_SCALAR_TYPES}. A matrix operand keeps its matrix type and its storage.
 */
function scalarCollectionSignatures(
  order: {
    scalarFirst?: CollectionKernels;
    collectionFirst?: CollectionKernels;
  },
  scalars: readonly string[] = OTHER_SCALAR_TYPES
): Record<string, CollectionKernel> {
  const rows: Record<string, CollectionKernel> = {};
  for (const scalar of scalars) {
    for (const collection of COLLECTION_TYPES) {
      const pick = (kernels: CollectionKernels): CollectionKernel =>
        collection === 'Array' ? kernels.array : kernels.matrix;
      if (order.scalarFirst) rows[`${scalar}, ${collection}`] = pick(order.scalarFirst);
      if (order.collectionFirst) rows[`${collection}, ${scalar}`] = pick(order.collectionFirst);
    }
  }
  return rows;
}

const addKernels = elementwiseKernels(addForNumberPath, addOp);
const subtractKernels = elementwiseKernels(subtractForNumberPath, subOp);
const multiplyKernels = elementwiseKernels(multiplyForNumberPath, mulOp, true);
const divideKernels = elementwiseKernels(divideForNumberPath, divOp, true);
const modKernels = elementwiseKernels(modForNumberPath, modOp, 'left');

/** The size of an Array or a matrix, in mathjs's shape: `[n]` for a vector, `[r, c]` otherwise. */
function collectionSize(collection: unknown): number[] {
  if (Array.isArray(collection)) {
    return Array.isArray(collection[0])
      ? [collection.length, (collection[0] as unknown[]).length]
      : [collection.length];
  }
  const m = collection as { size?: () => number[]; rows: number; cols: number };
  // The public matrix classes expose `rows` and `cols`; the factory (CSC and dense) classes expose `size()`.
  return typeof m.size === 'function' ? m.size() : [m.rows, m.cols];
}

/**
 * `divide(scalar, collection)` is a matrix division, `scalar * inv(collection)` (mathjs
 * parity, #960). A non-square collection throws mathjs's RangeError text. A singular square
 * collection throws the error of `inv` unchanged.
 */
function divideScalarByCollection(scalar: unknown, collection: unknown): unknown {
  const size = collectionSize(collection);
  if (size.length !== 2 || size[0] !== size[1]) {
    throw new RangeError(`Matrix must be square (size: [${size.join(', ')}])`);
  }
  const inverse = divideInverse()(collection);
  return (multiply as unknown as ScalarOp)(scalar, inverse);
}

const scalarOverCollection: CollectionKernels = {
  array: divideScalarByCollection,
  matrix: divideScalarByCollection,
};

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
  _exactSI?: unknown;
  equalBase(other: unknown): boolean;
  clone(): UnitLike;
  multiply(other: unknown): unknown;
  divide(other: unknown): unknown;
  divideInto(numerator: unknown): unknown;
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
    throw new DimensionMismatchError('Cannot add/subtract units with different dimensions');
  }
  if (ua.value == null || ub.value == null) {
    throw new Error('Cannot add/subtract a valueless unit');
  }
  const res = ua.clone();
  res.value = op(ua.value, ub.value);
  res._exactSI = undefined;
  return res;
}

const unitAdd = (a: unknown, b: unknown): unknown => unitAddSub(a, b, addOp);
const unitSub = (a: unknown, b: unknown): unknown => unitAddSub(a, b, (x, y) => subtract(x, y));
const unitMul = (a: unknown, b: unknown): unknown => asUnit(a).multiply(b);
const unitDiv = (a: unknown, b: unknown): unknown => asUnit(a).divide(b);

// =============================================================================
// Addition
// =============================================================================

/**
 * Polymorphic addition function. The Float64Array signature is synchronous.
 *
 * Float64Array inputs give a new Float64Array in the same thread (no worker pool).
 *
 * @example
 * ```typescript
 * add(1, 2);                                    // 3
 * add(new Complex(1, 2), new Complex(3, 4));   // Complex(4, 6)
 * add(new Fraction(1, 2), new Fraction(1, 3)); // Fraction(5, 6)
 * add(float64A, float64B);                     // Float64Array, synchronous
 * add(true, 1);                                // 2 (boolean coerces to 0/1)
 * ```
 *
 * `null`, `undefined`, strings, symbols, functions, and objects that are not a
 * numeric type, Unit, matrix, array, or typed array throw
 * `TypeError: add: unexpected type …`. A numeric string is not coerced to Complex.
 * `bigint` mixed with `number` returns a `number`, not a Fraction.
 */
export const add = withBinaryScalarGuards(
  'add',
  mathTyped('add', {
    'number, number': (a: f64, b: f64): f64 => a + b,

    'bigint, bigint': (a: i64, b: i64): i64 => a + b,

    'bigint, number': (a: i64, b: f64): f64 => Number(a) + b,

    'number, bigint': (a: f64, b: i64): f64 => a + Number(b),

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

    // Float64Array addition (synchronous)
    'Float64Array, Float64Array': (a: Float64Array, b: Float64Array): Float64Array =>
      f64Binary(a, b, (x, y) => x + y),

    // Element-wise addition over plain (possibly nested / N-D) arrays, with scalar
    // broadcast. Leaves fold through the binary `add`, so number / Complex /
    // Fraction / BigNumber elements all work.
    'Array, Array': (a: unknown[], b: unknown[]): unknown =>
      elementwiseNumber(addForNumberPath.fn!, addOp, a, b),
    'Array, number': (a: unknown[], b: f64): unknown =>
      elementwiseNumber(addForNumberPath.fn!, addOp, a, b),
    'number, Array': (a: f64, b: unknown[]): unknown =>
      elementwiseNumber(addForNumberPath.fn!, addOp, a, b),

    // Element-wise matrix addition (mathjs parity). Sparse⊕sparse stays sparse so
    // the CSparse algebra factories (csAmd's C = A + A', etc.) get CSC output.
    'DenseMatrix, DenseMatrix': (a: unknown, b: unknown): unknown =>
      elementwiseMatrixNumber(addForNumberPath.fn!, addOp, a, b),
    'SparseMatrix, SparseMatrix': (a: unknown, b: unknown): unknown =>
      elementwiseMatrixNumber(addForNumberPath.fn!, addOp, a, b),
    'DenseMatrix, number': (a: unknown, b: f64): unknown =>
      elementwiseMatrixNumber(addForNumberPath.fn!, addOp, a, b),
    'number, DenseMatrix': (a: f64, b: unknown): unknown =>
      elementwiseMatrixNumber(addForNumberPath.fn!, addOp, a, b),
    'SparseMatrix, number': (a: unknown, b: f64): unknown =>
      elementwiseMatrixNumber(addForNumberPath.fn!, addOp, a, b),
    'number, SparseMatrix': (a: f64, b: unknown): unknown =>
      elementwiseMatrixNumber(addForNumberPath.fn!, addOp, a, b),

    // A Unit, Complex, Fraction or BigNumber scalar and an Array or a matrix, in either
    // order: the per-element sums.
    ...scalarCollectionSignatures({ scalarFirst: addKernels, collectionFirst: addKernels }),

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
  })
) as PublicAdd;
addForNumberPath.fn = add;

// =============================================================================
// Subtraction
// =============================================================================

/**
 * Polymorphic subtraction function. The Float64Array signature is synchronous.
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

  // Float64Array subtraction (synchronous)
  'Float64Array, Float64Array': (a: Float64Array, b: Float64Array): Float64Array =>
    f64Binary(a, b, (x, y) => x - y),

  // Element-wise subtraction over plain (possibly nested / N-D) arrays, with scalar
  // broadcast. Leaves fold through the binary `subtract`, so number / Complex /
  // Fraction / BigNumber elements all work. Unlike `add`, there is no variadic form:
  // subtraction is binary (mathjs parity).
  'Array, Array': (a: unknown[], b: unknown[]): unknown =>
    elementwiseNumber(subtractForNumberPath.fn!, subOp, a, b),

  'Array, number': (a: unknown[], b: f64): unknown =>
    elementwiseNumber(subtractForNumberPath.fn!, subOp, a, b),
  'number, Array': (a: f64, b: unknown[]): unknown =>
    elementwiseNumber(subtractForNumberPath.fn!, subOp, a, b),

  // Element-wise matrix subtraction (mathjs parity). Sparse⊖sparse stays sparse so
  // the CSparse algebra factories get CSC output, as they do for `add`.
  'DenseMatrix, DenseMatrix': (a: unknown, b: unknown): unknown =>
    elementwiseMatrixNumber(subtractForNumberPath.fn!, subOp, a, b),
  'SparseMatrix, SparseMatrix': (a: unknown, b: unknown): unknown =>
    elementwiseMatrixNumber(subtractForNumberPath.fn!, subOp, a, b),
  'DenseMatrix, number': (a: unknown, b: f64): unknown =>
    elementwiseMatrixNumber(subtractForNumberPath.fn!, subOp, a, b),
  'number, DenseMatrix': (a: f64, b: unknown): unknown =>
    elementwiseMatrixNumber(subtractForNumberPath.fn!, subOp, a, b),
  'SparseMatrix, number': (a: unknown, b: f64): unknown =>
    elementwiseMatrixNumber(subtractForNumberPath.fn!, subOp, a, b),
  'number, SparseMatrix': (a: f64, b: unknown): unknown =>
    elementwiseMatrixNumber(subtractForNumberPath.fn!, subOp, a, b),

  // A Unit, Complex, Fraction or BigNumber scalar and an Array or a matrix, in either
  // order: the per-element differences.
  ...scalarCollectionSignatures({ scalarFirst: subtractKernels, collectionFirst: subtractKernels }),
});
subtractForNumberPath.fn = subtract;

// =============================================================================
// Multiplication
// =============================================================================

/**
 * Polymorphic multiplication function. The Float64Array signature is synchronous.
 * Invalid operands throw `TypeError: multiply: unexpected type …` (same rules as `add`).
 * Booleans coerce to 0/1. `bigint` mixed with `number` returns a `number`.
 */
export const multiply = withBinaryScalarGuards(
  'multiply',
  mathTyped('multiply', {
    'number, number': (a: f64, b: f64): f64 => a * b,

    'bigint, bigint': (a: i64, b: i64): i64 => a * b,

    'bigint, number': (a: i64, b: f64): f64 => Number(a) * b,

    'number, bigint': (a: f64, b: i64): f64 => a * Number(b),

    'Complex, Complex': (a: Complex, b: Complex): Complex => a.multiply(b),

    'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => a.multiply(b),

    'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => a.multiply(b),

    // Unit multiplication / scaling (mathjs parity).
    'Unit, Unit': (a: Unit, b: Unit): Unit => unitMul(a, b) as Unit,
    'Unit, number': (a: Unit, b: f64): Unit => unitMul(a, b) as Unit,
    'number, Unit': (a: f64, b: Unit): Unit => unitMul(b, a) as Unit,
    // Real scalars must be explicit. A missing signature lets Fraction/BigNumber
    // convert to Complex and hit `Complex, Unit`, which stores a zero-imaginary Complex
    // and formats as `(2) m` instead of `2 m`.
    'Fraction, Unit': (a: Fraction, b: Unit): Unit => unitMul(b, a) as Unit,
    'Unit, Fraction': (a: Unit, b: Fraction): Unit => unitMul(a, b) as Unit,
    'BigNumber, Unit': (a: BigNumber, b: Unit): Unit => unitMul(b, a) as Unit,
    'Unit, BigNumber': (a: Unit, b: BigNumber): Unit => unitMul(a, b) as Unit,
    'Complex, Unit': (a: Complex, b: Unit): Unit => unitMul(b, a) as Unit,
    'Unit, Complex': (a: Unit, b: Complex): Unit => unitMul(a, b) as Unit,

    // Dual numbers (forward-mode AD).
    'Dual, Dual': (a: Dual, b: Dual): Dual => a.mul(b),
    'Dual, number': (a: Dual, b: f64): Dual => a.mul(Dual.constant(b)),
    'number, Dual': (a: f64, b: Dual): Dual => Dual.constant(a).mul(b),

    // Matrix × matrix (2-D arrays) routed through the native DenseMatrix +
    // BackendManager — i.e. WASM/GPU acceleration for large matrices (GC7).
    // Previously `multiply(2DArray, 2DArray)` threw; this is additive. Non-2-D
    // Array operands throw a clear message pointing at the right primitive.
    'Array, Array': (a: unknown[], b: unknown[]): unknown[][] => {
      if (!Array.isArray(a[0]) || !Array.isArray(b[0])) {
        throw new TypeError(
          'multiply(Array, Array) requires two 2-D matrices; use dot() for vector dot products'
        );
      }
      return matrixProduct(a, b);
    },

    // Matrix × matrix on boxed matrices returns a boxed matrix (mathjs parity) —
    // NOT a bare array. The `Array, Array` path above returns an array, and
    // reaching it via the Matrix~>Array conversion would strip the matrix type
    // (breaking callers like `sylvester` that call `.toArray()` on the product).
    'DenseMatrix, DenseMatrix': (a: unknown, b: unknown): unknown => {
      return new MathJSDenseMatrix(matrixProduct(a, b) as number[][]);
    },

    // Matrix product with a sparse operand. mathjs returns a sparse matrix for two sparse
    // operands and a dense matrix for a sparse and a dense operand.
    'SparseMatrix, SparseMatrix': (a: unknown, b: unknown): unknown => {
      const product = matrixProduct(a, b);
      if (isSparseMatrix(a) || isSparseMatrix(b)) return publicSparseOrDense(product);
      return new MathJSSparseMatrix(product);
    },
    'SparseMatrix, DenseMatrix': (a: unknown, b: unknown): unknown =>
      new MathJSDenseMatrix(matrixProduct(a, b) as number[][]),
    'DenseMatrix, SparseMatrix': (a: unknown, b: unknown): unknown =>
      new MathJSDenseMatrix(matrixProduct(a, b) as number[][]),

    'number, Complex': (a: f64, b: Complex): Complex => b.multiply(Complex.fromNumber(a)),
    'Complex, number': (a: Complex, b: f64): Complex => a.multiply(Complex.fromNumber(b)),

    'number, Fraction': (a: f64, b: Fraction): Fraction => b.multiply(Fraction.fromNumber(a)),
    'Fraction, number': (a: Fraction, b: f64): Fraction => a.multiply(Fraction.fromNumber(b)),

    'number, BigNumber': (a: f64, b: BigNumber): BigNumber => b.multiply(BigNumber.fromNumber(a)),
    'BigNumber, number': (a: BigNumber, b: f64): BigNumber => a.multiply(BigNumber.fromNumber(b)),

    // Float64Array element-wise multiplication (synchronous)
    'Float64Array, Float64Array': (a: Float64Array, b: Float64Array): Float64Array =>
      f64Binary(a, b, (x, y) => x * y),

    // Float64Array scaled by a number (synchronous)
    'Float64Array, number': (a: Float64Array, scalar: f64): Float64Array =>
      f64Unary(a, (x) => x * scalar),

    'number, Float64Array': (scalar: f64, a: Float64Array): Float64Array =>
      f64Unary(a, (x) => scalar * x),

    // Scalar × collection = element-wise scaling (mathjs parity). Matrix × matrix
    // stays matrix multiplication — the `Array, Array` matmul above (reached for
    // Matrix operands via the Matrix~>Array conversion); element-wise product of
    // two collections is `dotMultiply`.
    'Array, number': (a: unknown[], b: f64): unknown =>
      elementwiseNumber(multiplyForNumberPath.fn!, mulOp, a, b),
    'number, Array': (a: f64, b: unknown[]): unknown =>
      elementwiseNumber(multiplyForNumberPath.fn!, mulOp, a, b),
    'DenseMatrix, number': (a: unknown, b: f64): unknown =>
      elementwiseMatrixNumber(multiplyForNumberPath.fn!, mulOp, a, b, true),
    'number, DenseMatrix': (a: f64, b: unknown): unknown =>
      elementwiseMatrixNumber(multiplyForNumberPath.fn!, mulOp, a, b, true),
    'SparseMatrix, number': (a: unknown, b: f64): unknown =>
      elementwiseMatrixNumber(multiplyForNumberPath.fn!, mulOp, a, b, true),
    'number, SparseMatrix': (a: f64, b: unknown): unknown =>
      elementwiseMatrixNumber(multiplyForNumberPath.fn!, mulOp, a, b, true),

    // The same scaling for a Unit, Complex, Fraction or BigNumber scalar, in either order
    // (#911). Before, `number` was the only scalar with a collection signature.
    ...scalarCollectionSignatures({
      scalarFirst: multiplyKernels,
      collectionFirst: multiplyKernels,
    }),

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
  })
);
multiplyForNumberPath.fn = multiply;

// =============================================================================
// Division
// =============================================================================

/**
 * Polymorphic division function. The Float64Array signature is synchronous.
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
  // Same conversion trap as multiply: without these, `1 / (2 ohm)` becomes Complex.
  'number, Unit': (a: f64, b: Unit): Unit => asUnit(b).divideInto(a) as Unit,
  'Fraction, Unit': (a: Fraction, b: Unit): Unit => asUnit(b).divideInto(a) as Unit,
  'Unit, Fraction': (a: Unit, b: Fraction): Unit => unitDiv(a, b) as Unit,
  'BigNumber, Unit': (a: BigNumber, b: Unit): Unit => asUnit(b).divideInto(a) as Unit,
  'Unit, BigNumber': (a: Unit, b: BigNumber): Unit => unitDiv(a, b) as Unit,
  'Complex, Unit': (a: Complex, b: Unit): Unit => asUnit(b).divideInto(a) as Unit,
  'Unit, Complex': (a: Unit, b: Complex): Unit => unitDiv(a, b) as Unit,

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

  // Float64Array element-wise division (synchronous)
  'Float64Array, Float64Array': (a: Float64Array, b: Float64Array): Float64Array =>
    f64Binary(a, b, (x, y) => x / y),

  // A collection divided by a scalar divides each element (mathjs parity, #911). A scalar
  // divided by a collection is a matrix division and throws a clear error.
  ...scalarCollectionSignatures(
    { collectionFirst: divideKernels, scalarFirst: scalarOverCollection },
    ALL_SCALAR_TYPES
  ),
});
divideForNumberPath.fn = divide;

// =============================================================================
// Unary Operations
// =============================================================================

/**
 * Unary negation. The Float64Array signature is synchronous.
 */
export const unaryMinus = mathTyped('unaryMinus', {
  number: (a: f64): f64 => -a,
  bigint: (a: i64): i64 => -a,
  Complex: (a: Complex): Complex => a.negate(),
  Fraction: (a: Fraction): Fraction => a.negate(),
  BigNumber: (a: BigNumber): BigNumber => a.negate(),

  // Float64Array negation (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, (x) => -x),
  'Array | Matrix': unaryCollection({ real: (x) => -x }),
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
  'Array | Matrix': unaryCollection({ real: (x) => +x }),
});

/**
 * Absolute value. The Float64Array signature is synchronous.
 */
export const abs = mathTyped('abs', {
  number: (a: f64): f64 => Math.abs(a),
  bigint: (a: i64): i64 => (a < 0n ? -a : a),
  Complex: (a: Complex): f64 => a.abs(),
  Fraction: (a: Fraction): Fraction => a.abs(),
  BigNumber: (a: BigNumber): BigNumber => a.abs(),
  Dual: (a: Dual): Dual => a.abs(),
  Unit: (a: Unit): Unit => asUnit(a).abs() as unknown as Unit,

  // Float64Array abs (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64UnaryDispatched(a, 'abs', (x) => Math.abs(x)),
  'Array | Matrix': unaryCollection({ real: Math.abs, wasmKernel: 'abs' }),
}) as PublicAbs;

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

  // Float64Array sign (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, (x) => Math.sign(x)),
  'Array | Matrix': unaryCollection({ real: Math.sign }),
});

// =============================================================================
// Power and Root Operations
// =============================================================================

/**
 * Power function
 */
export const pow = mathTyped('pow', {
  // Hot cases stay inline.
  'number, number': (a: f64, b: f64): f64 | Complex => powReal(a, b),
  'bigint, bigint': (a: i64, b: i64): i64 => a ** b,

  // Rich-type policy cases DELEGATE to core's scalar `pow`, which correctly guards
  // non-integer exponents of exact types (falling back to double-precision Math.pow,
  // returning a plain number). The old inline copies were buggy:
  //   pow(BigNumber(2), 0.5)  -> 1     (unguarded a.pow(0.5); core -> 1.4142…)
  //   pow(Fraction(3), 2.9)   -> 27    (silently floored via a.pow(Math.floor(b)); core -> 24.19…)
  'Complex, number': (a: Complex, b: f64): Complex => corePow(a, b) as Complex,
  'Complex, Complex': (a: Complex, b: Complex): Complex => corePow(a, b) as Complex,
  'Fraction, number': (a: Fraction, b: f64): Fraction | f64 => corePow(a, b) as Fraction | f64,
  // A BigNumber base takes the BigNumber kernel shared with the factory `pow` (mathjs rules).
  'BigNumber, number': (a: BigNumber, b: f64): BigNumber | Complex =>
    powBigNumberWith(a, BigNumber.fromNumber(b), isPredictableMode()),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber | Complex =>
    powBigNumberWith(a, b, isPredictableMode()),
  // Dual numbers (forward-mode AD): constant or variable exponent.
  'Dual, number': (a: Dual, b: f64): Dual => a.powConst(b),
  'Dual, Dual': (a: Dual, b: Dual): Dual => a.pow(b),
  // Dimensional power, including physics-mode `e^2` (elementary charge squared).
  'Unit, number': (a: Unit, b: f64): Unit | f64 => a.pow(b) as Unit | f64,

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
 * Square root. The Float64Array signature is synchronous.
 */
export const sqrt = mathTyped('sqrt', {
  number: (a: f64): f64 | Complex => sqrtReal(a),
  Complex: (a: Complex): Complex => a.sqrt(),
  BigNumber: (a: BigNumber): BigNumber | Complex => sqrtBigNumberWith(a, isPredictableMode()),
  // A Fraction has no exact square root in general. Use the number path. The result is a
  // number for x >= 0 and a Complex for x < 0 (#1044).
  Fraction: (a: Fraction): f64 | Complex => sqrtReal(a.valueOf()),
  Dual: (a: Dual): Dual => a.sqrt(),

  // Float64Array sqrt (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, (x) => Math.sqrt(x)),
  'Array | Matrix': unaryCollection({ real: Math.sqrt, inRealDomain: staysRealSqrt }),
}) as PublicSqrt;

/**
 * Square. The Float64Array signature is synchronous.
 */
export const square = mathTyped('square', {
  number: (a: f64): f64 => a * a,
  bigint: (a: i64): i64 => a * a,
  Complex: (a: Complex): Complex => a.multiply(a),
  Fraction: (a: Fraction): Fraction => a.multiply(a),
  BigNumber: (a: BigNumber): BigNumber => a.multiply(a),
  Dual: (a: Dual): Dual => a.square(),

  // Float64Array square (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, (x) => x * x),
  'Array | Matrix': unaryCollection({ real: (x) => x * x }),
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

  // Float64Array cube (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, (x) => x * x * x),
  'Array | Matrix': unaryCollection({ real: (x) => x * x * x }),
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

  // Float64Array cbrt (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, (x) => Math.cbrt(x)),
  'Array | Matrix': unaryCollection({ real: Math.cbrt }),
});

/**
 * N-th root
 */
export const nthRoot = mathTyped('nthRoot', {
  'number, number': (a: f64, n: f64): f64 => nthRootReal(a, n),
  number: (a: f64): f64 => nthRootReal(a, 2),
  BigNumber: (a: BigNumber): BigNumber => bigNthRoot(a, 2),
  'Complex, number': (a: Complex, n: f64): Complex => a.pow(1 / n),
  'BigNumber, number': (a: BigNumber, n: f64): BigNumber => bigNthRoot(a, n),
  'BigNumber, BigNumber': (a: BigNumber, n: BigNumber): BigNumber => bigNthRoot(a, n.toNumber()),
  'Array | Matrix': mapEachLeaf((self, x) => self(x)),
  'Array | Matrix, number': mapEachLeaf((self, x, n) => self(x, n)),
});

/**
 * Real n-th root of a BigNumber. The function computes the exponent 1/n in BigNumber
 * precision, not as a double. A negative base with an odd integer root gives
 * a negative real root.
 */
function bigNthRoot(a: BigNumber, n: f64): BigNumber {
  if (n === 0) {
    throw new Error('Root must be non-zero');
  }
  if (a.isNegative() && Number.isInteger(n) && Math.abs(n) % 2 === 1) {
    return bigNthRoot(a.neg(), n).neg();
  }
  // The error of 1/n is multiplied by ln(a), so the exponent gets extra digits for its order.
  const precision = BigNumber.precision;
  const lnOrder =
    a.isZero() || !a.isFinite() ? 0 : Math.ceil(Math.log10(Math.abs(a.abs().ln().toNumber()) + 1));
  BigNumber.config({ precision: precision + NTH_ROOT_GUARD_DIGITS + lnOrder });
  try {
    return a.pow(new BigNumber(1).div(new BigNumber(n))).toSignificantDigits(precision);
  } finally {
    BigNumber.config({ precision });
  }
}

/** Extra digits for the exponent 1/n in `bigNthRoot`. */
const NTH_ROOT_GUARD_DIGITS = 10;

// =============================================================================
// Exponential and Logarithmic
// =============================================================================

/**
 * Exponential function (e^x). The Float64Array signature is synchronous.
 */
export const exp = mathTyped('exp', {
  number: (a: f64): f64 => Math.exp(a),
  Complex: (a: Complex): Complex => a.exp(),
  BigNumber: (a: BigNumber): BigNumber => a.exp(),
  Dual: (a: Dual): Dual => a.exp(),

  // Float64Array exp (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64UnaryDispatched(a, 'exp', (x) => Math.exp(x)),
  'Array | Matrix': unaryCollection({ real: Math.exp, wasmKernel: 'exp' }),
}) as PublicExp;

/**
 * Natural logarithm (ln x). The Float64Array signature is synchronous.
 */
/** log10 or log2 of a BigNumber; a negative value gives the Complex logarithm over `lnBase`. */
function logBigNumberScaled(
  a: BigNumber,
  method: 'log10' | 'log2',
  lnBase: number
): BigNumber | Complex {
  const ln = logBigNumberWith(a, isPredictableMode());
  return ln instanceof Complex ? ln.divide(Complex.fromNumber(lnBase)) : a[method]();
}

/** log(a) / log(base) of two BigNumbers; a Complex logarithm makes the quotient Complex. */
function logBigNumberBase(a: BigNumber, base: BigNumber): BigNumber | Complex {
  const predictable = isPredictableMode();
  const x = logBigNumberWith(a, predictable);
  const y = logBigNumberWith(base, predictable);
  if (x instanceof BigNumber && y instanceof BigNumber) return x.divide(y);
  const cx = x instanceof Complex ? x : Complex.fromNumber(x.toNumber());
  const cy = y instanceof Complex ? y : Complex.fromNumber(y.toNumber());
  return cx.divide(cy);
}

/** A BigNumber rounded to `decimals` places with the live `relTol` and `absTol`. */
function roundBigNumberLive(a: BigNumber, decimals: number): BigNumber {
  const { relTol, absTol } = liveConfig();
  return roundBigNumberDecimals(a, decimals, relTol, absTol);
}

export const log = mathTyped('log', {
  number: (a: f64): f64 | Complex => logReal(a),
  Complex: (a: Complex): Complex => a.log(),
  BigNumber: (a: BigNumber): BigNumber | Complex => logBigNumberWith(a, isPredictableMode()),
  Dual: (a: Dual): Dual => a.log(),
  'number, number': (a: f64, base: f64): f64 | Complex => logRealBase(a, base),
  'BigNumber, BigNumber': (a: BigNumber, base: BigNumber): BigNumber | Complex =>
    logBigNumberBase(a, base),

  // Float64Array log (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64UnaryDispatched(a, 'log', (x) => Math.log(x)),
  'Array | Matrix': unaryCollection({
    real: Math.log,
    wasmKernel: 'log',
    inRealDomain: staysRealLog,
  }),
}) as PublicLog;

/**
 * Base-10 logarithm
 */
export const log10 = mathTyped('log10', {
  number: (a: f64): f64 | Complex => log10Real(a),
  Complex: (a: Complex): Complex => a.log().divide(Complex.fromNumber(Math.LN10)),
  BigNumber: (a: BigNumber): BigNumber | Complex => logBigNumberScaled(a, 'log10', Math.LN10),

  // Float64Array log10 (synchronous)
  Float64Array: (a: Float64Array): Float64Array =>
    f64UnaryDispatched(a, 'log10', (x) => Math.log10(x)),
  'Array | Matrix': unaryCollection({
    real: Math.log10,
    wasmKernel: 'log10',
    inRealDomain: staysRealLog,
  }),
}) as PublicLog10;

/**
 * Base-2 logarithm
 */
export const log2 = mathTyped('log2', {
  number: (a: f64): f64 | Complex => log2Real(a),
  Complex: (a: Complex): Complex => a.log().divide(Complex.fromNumber(Math.LN2)),
  BigNumber: (a: BigNumber): BigNumber | Complex => logBigNumberScaled(a, 'log2', Math.LN2),

  // Float64Array log2 (synchronous)
  Float64Array: (a: Float64Array): Float64Array =>
    f64UnaryDispatched(a, 'log2', (x) => Math.log2(x)),
  'Array | Matrix': unaryCollection({
    real: Math.log2,
    wasmKernel: 'log2',
    inRealDomain: staysRealLog,
  }),
});

/**
 * log(1 + x) with higher precision for small x
 */
export const log1p = mathTyped('log1p', {
  number: (a: f64): f64 | Complex => log1pReal(a),
  BigNumber: (a: BigNumber): BigNumber | Complex => log1pBigNumberWith(a, isPredictableMode()),

  // Float64Array log1p (synchronous)
  Float64Array: (a: Float64Array): Float64Array =>
    f64UnaryDispatched(a, 'log1p', (x) => Math.log1p(x)),
  'Array | Matrix': unaryCollection({
    real: Math.log1p,
    wasmKernel: 'log1p',
    inRealDomain: staysRealLog1p,
  }),
});

/**
 * exp(x) - 1 with higher precision for small x
 */
export const expm1 = mathTyped('expm1', {
  number: (a: f64): f64 => Math.expm1(a),
  BigNumber: (a: BigNumber): BigNumber => a.exp().subtract(1),

  // Float64Array expm1 (synchronous)
  Float64Array: (a: Float64Array): Float64Array =>
    f64UnaryDispatched(a, 'expm1', (x) => Math.expm1(x)),
  'Array | Matrix': unaryCollection({ real: Math.expm1, wasmKernel: 'expm1' }),
});

// =============================================================================
// Rounding Operations
// =============================================================================

/**
 * Round to nearest integer
 */
export const round = mathTyped('round', {
  number: (a: f64): f64 => Math.round(a),
  // Rich-type policy cases DELEGATE to core's scalar `round`, which uses `halfCeil`
  // for BigNumber so round(bignumber(-2.5)) = -2 (type-consistent with number/Fraction),
  // not the -3 the old inline `a.round()` (half-away-from-zero) produced.
  Fraction: (a: Fraction): Fraction => coreRound(a) as Fraction,
  BigNumber: (a: BigNumber): BigNumber => coreRound(a) as BigNumber,
  Complex: (a: Complex): Complex => coreRound(a) as Complex,
  'number, number': (a: f64, decimals: f64): f64 => {
    const factor = Math.pow(10, decimals);
    return Math.round(a * factor) / factor;
  },
  'BigNumber, number': (a: BigNumber, decimals: f64): BigNumber => roundBigNumberLive(a, decimals),
  'BigNumber, BigNumber': (a: BigNumber, decimals: BigNumber): BigNumber => {
    if (!decimals.isInteger()) throw new TypeError(ROUND_DECIMALS_NOT_INTEGER);
    return roundBigNumberLive(a, decimals.toNumber());
  },

  // Float64Array round, synchronous (nearest integer, matching the 'number' overload)
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, (x) => Math.round(x)),
  'Array | Matrix': unaryCollection({ real: Math.round }),
});

/**
 * Floor (round down)
 */
export const floor = mathTyped('floor', {
  number: (a: f64): f64 => Math.floor(a),
  Fraction: (a: Fraction): Fraction => a.floor(),
  BigNumber: (a: BigNumber): BigNumber => a.floor(),
  Complex: (a: Complex): Complex => new Complex(Math.floor(a.re), Math.floor(a.im)),

  // Float64Array floor (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, (x) => Math.floor(x)),
  'Array | Matrix': unaryCollection({ real: Math.floor }),
});

/**
 * Ceiling (round up)
 */
export const ceil = mathTyped('ceil', {
  number: (a: f64): f64 => Math.ceil(a),
  Fraction: (a: Fraction): Fraction => a.ceil(),
  BigNumber: (a: BigNumber): BigNumber => a.ceil(),
  Complex: (a: Complex): Complex => new Complex(Math.ceil(a.re), Math.ceil(a.im)),

  // Float64Array ceil (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, (x) => Math.ceil(x)),
  'Array | Matrix': unaryCollection({ real: Math.ceil }),
});

/**
 * Truncate (round toward zero)
 */
export const fix = mathTyped('fix', {
  number: (a: f64): f64 => Math.trunc(a),
  // Rich-type policy cases DELEGATE to core's scalar `fix` (truncate toward zero:
  // floor for non-negative, ceil for negative). Removes the duplicated policy.
  Fraction: (a: Fraction): Fraction => coreFix(a) as Fraction,
  BigNumber: (a: BigNumber): BigNumber => coreFix(a) as BigNumber,
  Complex: (a: Complex): Complex => coreFix(a) as Complex,

  // Float64Array fix, synchronous (truncate toward zero, matching the 'number' overload)
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, (x) => Math.trunc(x)),
  'Array | Matrix': unaryCollection({ real: Math.trunc }),
});

// =============================================================================
// Modular Operations
// =============================================================================

/** The scalar types of `mod`. Each one combines with an Array or a matrix. */
const MOD_SCALAR_TYPES = ['number', 'bigint', 'Fraction', 'BigNumber'] as const;

/**
 * Modulo operation. The result has the sign of the divisor. A zero divisor returns the dividend
 * (mathjs rule, #923).
 *
 * An Array or a matrix applies the rule to each element, as `add` and `subtract` do. The
 * operands are two collections of the same shape, or a collection and a scalar in either order
 * (`mod([10, 20], 0)` is `[10, 20]`). A matrix operand gives a matrix: dense unless an operand is
 * sparse. The operands do not broadcast: arrays of different lengths throw a `RangeError`.
 */
export const mod = mathTyped('mod', {
  'number, number': (a: f64, b: f64): f64 => (b === 0 ? a : ((a % b) + b) % b),
  'bigint, bigint': (a: i64, b: i64): i64 => (b === 0n ? a : ((a % b) + b) % b),
  'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => (b.isZero() ? a : a.mod(b)),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => (b.isZero() ? a : a.mod(b)),

  'Array, Array': modKernels.array,
  'DenseMatrix, DenseMatrix': modKernels.matrix,
  'SparseMatrix, SparseMatrix': modKernels.matrix,
  'DenseMatrix, SparseMatrix': modKernels.matrix,
  'SparseMatrix, DenseMatrix': modKernels.matrix,
  'Array, DenseMatrix': modKernels.matrix,
  'DenseMatrix, Array': modKernels.matrix,
  'Array, SparseMatrix': modKernels.matrix,
  'SparseMatrix, Array': modKernels.matrix,
  ...scalarCollectionSignatures(
    { scalarFirst: modKernels, collectionFirst: modKernels },
    MOD_SCALAR_TYPES
  ),
});
modForNumberPath.fn = mod;

/** These are the call signatures of `gcd`. Each signature returns the type of its two arguments. */
interface GcdOverloads {
  (a: number, b: number): number;
  (a: bigint, b: bigint): bigint;
  (a: BigNumber, b: BigNumber): BigNumber;
}

/** `gcd` with its precise call signatures. `gcd` is still a `TypedFunction`. */
export type GcdFunction = GcdOverloads & TypedFunction;

/**
 * Greatest common divisor
 */
export const gcd: GcdFunction = mathTyped('gcd', {
  'number, number': (a: f64, b: f64): f64 => {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new Error('Parameters in function gcd must be integer numbers');
    }
    return euclidSnap(a, b, Math.floor);
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
    // NaN, Infinity and a fraction have no integer gcd. The loop below never ends on them.
    if (!a.isInteger() || !b.isInteger()) {
      throw new Error('Parameters in function gcd must be integer numbers');
    }
    let x = a.abs();
    let y = b.abs();
    while (!y.isZero()) {
      const t = y;
      y = x.mod(y);
      x = t;
    }
    return x;
  },
  // The gcd of the entries of a vector, as in mathjs. A matrix of two or more dimensions throws.
  'Array | Matrix': mathTyped.referToSelf((self) => (input: unknown[] | { toArray(): unknown }) => {
    const v = (Array.isArray(input) ? input : input.toArray()) as unknown[];
    if (v.length === 0) throw new TypeError('gcd: expects at least one value');
    if (v.some(Array.isArray)) throw new TypeError('gcd: expects a vector (1-D), not a matrix');
    return v.reduce((acc, x) => (self as (a: unknown, b: unknown) => unknown)(acc, x));
  }),
}) as GcdFunction;

/**
 * Least common multiple
 */
export const lcm = mathTyped('lcm', {
  'number, number': (a: f64, b: f64): f64 => {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new Error('Parameters in function lcm must be integer numbers');
    }
    const g = gcd(a, b);
    return g === 0 ? 0 : Math.abs(a * b) / g;
  },
  'bigint, bigint': (a: i64, b: i64): i64 => {
    const g = gcd(a, b);
    if (g === 0n) return 0n;
    const absA = a < 0n ? -a : a;
    const absB = b < 0n ? -b : b;
    return (absA * absB) / g;
  },
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => {
    if (!a.isInteger() || !b.isInteger()) {
      throw new Error('Parameters in function lcm must be integer numbers');
    }
    const g = gcd(a, b);
    if (g.isZero()) return BigNumber.fromNumber(0);
    // The product rounds to the precision (#1118). With the digits of a and b together, the
    // product and the quotient are exact, and the result rounds one time.
    return atWorkPrecision(BigNumber, a.e + b.e + 4, () => a.abs().multiply(b.abs()).divide(g));
  },
});

/**
 * Extended greatest common divisor
 * Returns [gcd, x, y] where gcd = a*x + b*y (Bezout coefficients)
 */
export const xgcd = mathTyped('xgcd', {
  'number, number': (a: f64, b: f64): [f64, f64, f64] => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return [NaN, NaN, NaN];
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
  'Fraction, Fraction': (a: Fraction, b: Fraction): [Fraction, Fraction, Fraction] => {
    if (!a.isInteger() || !b.isInteger()) {
      throw new Error('Parameters in function xgcd must be integer numbers');
    }
    const zero = new Fraction(0n, 1n);
    const one = new Fraction(1n, 1n);
    let x = zero,
      lastX = one;
    let y = one,
      lastY = zero;
    while (!b.isZero()) {
      const q = a.divide(b).floor();
      const r = a.mod(b);
      const nextX = lastX.subtract(q.multiply(x)) as Fraction;
      const nextY = lastY.subtract(q.multiply(y)) as Fraction;
      lastX = x;
      x = nextX;
      lastY = y;
      y = nextY;
      a = b;
      b = r;
    }
    return a.lessThan(zero)
      ? [a.negate(), lastX.negate(), lastY.negate()]
      : [a, !a.isZero() ? lastX : zero, lastY];
  },
});

/**
 * Vector/array norm (Euclidean norm by default). The Float64Array signature is synchronous.
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

  // 2-norm via LAPACK's dnrm2 scaling, NOT `sqrt(sum(x*x))`.
  //
  // Squaring before adding dies well inside the representable range:
  //   norm([1e200 x 4])  -> Infinity   (the true answer, 2e200, is representable)
  //   norm([1e-200 x 4]) -> 0          (silently wrong, which is worse than Infinity)
  // NumPy has this bug too — `np.linalg.norm([1e200]*4)` is `inf`. We don't.
  if (p === 2) return norm2(arr);

  // General p-norm: still accumulate PAIRWISE so the sum does not drift as O(n)*eps.
  const terms = new Array<f64>(arr.length);
  for (let i = 0; i < arr.length; i++) terms[i] = Math.pow(Math.abs(arr[i]), p);
  const plain = Math.pow(pairwiseSum(terms), 1 / p);
  if (Number.isFinite(plain) && plain !== 0) return plain;
  // A sum of p-th powers can overflow or underflow when the norm is in range (#1255). Then the
  // norm is m * norm(x / m, p), with m = max(abs(x)).
  const m = Math.max(...arr.map((x) => Math.abs(x)));
  if (!Number.isFinite(m) || m === 0) return plain;
  for (let i = 0; i < arr.length; i++) terms[i] = Math.pow(Math.abs(arr[i]) / m, p);
  return m * Math.pow(pairwiseSum(terms), 1 / p);
}

/**
 * Matrix norm of a 2-D array. Supports Frobenius (`'fro'`/`'frobenius'`), the
 * max-column-sum 1-norm, the max-row-sum ∞-norm, and the spectral 2-norm (largest
 * singular value). The 2-norm is the default, as in mathjs.
 */
function matrixNorm(data: f64[][], p: f64 | string = 2): f64 {
  const rows = data.length;
  const cols = rows > 0 ? data[0].length : 0;
  if (p === 'fro' || p === 'frobenius') {
    let s = 0;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) s += data[i][j] * data[i][j];
    // The sum of squares overflows above about 1e154 and loses its digits below about
    // 1e-150 (#1104). Then the scaled norm of the finite entries is returned.
    if (s >= 2 ** -800 && s < Infinity) return Math.sqrt(s);
    const entries = data.flat();
    return entries.every(Number.isFinite) ? norm2(entries) : Math.sqrt(s);
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

/** True when every leaf of a 1-D or 2-D array is a number. */
function isNumberArrayDeep(arr: readonly unknown[]): boolean {
  return arr.every((x) =>
    Array.isArray(x) ? x.every((y) => typeof y === 'number') : typeof x === 'number'
  );
}

/**
 * The norm of an array with exact entries, by the factory norm, which keeps a BigNumber result
 * at the configured precision (#1043). The factory is read at call time from `factoryScope`.
 */
function exactNorm(arr: unknown[], p?: number | string): unknown {
  const factoryNorm = factoryScope.norm as ((x: unknown, p?: unknown) => unknown) | undefined;
  if (factoryNorm === undefined) throw new Error('norm: the factory norm is not loaded');
  return p === undefined ? factoryNorm(arr) : factoryNorm(arr, p);
}

/** The norm of a 1-D or 2-D array; see {@link norm}. */
function arrayNorm(arr: unknown[], p?: f64 | string): unknown {
  if (!isNumberArrayDeep(arr)) return exactNorm(arr, p);
  if (is2DArray(arr)) return matrixNorm(arr as f64[][], p);
  if (typeof p === 'string') return matrixNorm([arr as f64[]], p);
  return vectorNorm(arr as f64[], p);
}

export const norm = mathTyped('norm', {
  number: (a: f64): f64 => Math.abs(a),
  Complex: (a: Complex): f64 => a.abs(),
  BigNumber: (a: BigNumber): BigNumber => a.abs(),

  // Array: a flat vector uses the vector norm; a 2-D array is a matrix, whose default is the
  // 2-norm (largest singular value), as in mathjs. An array with a BigNumber, Fraction or Complex
  // entry takes the exact factory norm (#1043). A matrix uses the same rows as its array.
  Array: (arr: unknown[]): unknown => arrayNorm(arr),
  'Array, number': (arr: unknown[], p: f64): unknown => arrayNorm(arr, p),
  'Array, string': (arr: unknown[], p: string): unknown => arrayNorm(arr, p),
  'DenseMatrix | SparseMatrix': (m: { toArray(): unknown }): unknown =>
    arrayNorm(m.toArray() as unknown[]),
  'DenseMatrix | SparseMatrix, number | string': (
    m: { toArray(): unknown },
    p: f64 | string
  ): unknown => arrayNorm(m.toArray() as unknown[], p),

  // Float64Array norm (Euclidean), synchronous. The worker version is computePool.norm.
  Float64Array: (a: Float64Array): f64 => {
    // Scaled (LAPACK dnrm2), not `sqrt(sum(x*x))` — squaring before adding overflows to Infinity
    // around 1e200 and flushes to ZERO around 1e-200. See `norm2`.
    return norm2(a);
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

  // Float64Array sinh (synchronous)
  Float64Array: (a: Float64Array): Float64Array =>
    f64UnaryDispatched(a, 'sinh', (x) => Math.sinh(x)),
  'Array | Matrix': unaryCollection({ real: Math.sinh, wasmKernel: 'sinh' }),
});

/**
 * Hyperbolic cosine
 */
export const cosh = mathTyped('cosh', {
  number: (a: f64): f64 => Math.cosh(a),
  Complex: (a: Complex): Complex => a.cosh(),
  BigNumber: (a: BigNumber): BigNumber => a.cosh(),

  // Float64Array cosh (synchronous)
  Float64Array: (a: Float64Array): Float64Array => f64Unary(a, (x) => Math.cosh(x)),
  'Array | Matrix': unaryCollection({ real: Math.cosh }),
});

/**
 * Hyperbolic tangent
 */
export const tanh = mathTyped('tanh', {
  number: (a: f64): f64 => Math.tanh(a),
  Complex: (a: Complex): Complex => a.tanh(),
  BigNumber: (a: BigNumber): BigNumber => a.tanh(),

  // Float64Array tanh (synchronous)
  Float64Array: (a: Float64Array): Float64Array =>
    f64UnaryDispatched(a, 'tanh', (x) => Math.tanh(x)),
  'Array | Matrix': unaryCollection({ real: Math.tanh, wasmKernel: 'tanh' }),
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
  // number,number DELEGATES to core's TOLERANCE-based equality (relTol/absTol via
  // nearlyEqual) — mathjs parity. The old strict `a === b` made equal(0.1+0.2, 0.3)
  // return false; core (and mathjs) return true. Floats are almost never bit-equal
  // after arithmetic, so strict === is the wrong policy for a public math `equal`.
  'number, number': (a: f64, b: f64): boolean => coreEqual(a, b),
  // bigint stays inline (core also compares bigints with ===; tolerance is meaningless).
  'bigint, bigint': (a: i64, b: i64): boolean => a === b,
  // Rich-type cases delegate to core (exact equality for Fraction/BigNumber; Complex.equals).
  'Complex, Complex': (a: Complex, b: Complex): boolean => coreEqual(a, b),
  'Fraction, Fraction': (a: Fraction, b: Fraction): boolean => coreEqual(a, b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): boolean => coreEqual(a, b),
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
  // NaN compares as -1, the same as mathjs compare.
  'number, number': (a: f64, b: f64): i32 => (a > b ? 1 : a === b ? 0 : -1),
  'bigint, bigint': (a: i64, b: i64): i32 => (a > b ? 1 : a < b ? -1 : 0),
  'Fraction, Fraction': (a: Fraction, b: Fraction): i32 => a.compare(b),
  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): i32 => a.compare(b),
  'Unit, Unit': (a: Unit, b: Unit): i32 => unitCmp(a, b),
});

// =============================================================================
// Min/Max Operations
// =============================================================================

/**
 * The min (`isMax` false) or max of an array whose leaves are all numbers, at any depth. An empty
 * array gives Infinity or -Infinity. Equal values keep the first one and a NaN makes the result
 * NaN, as in mathjs. Returns `undefined` at the first leaf that is not a number, so the caller can
 * use the exact function. A nested array gives the same value as its flat form.
 */
function numberExtremum(arr: unknown[], isMax: boolean): number | undefined {
  const flat = isMax ? flatMax(arr) : flatMin(arr);
  if (flat !== undefined) return flat;
  const state = { m: isMax ? -Infinity : Infinity, nan: false };
  return extremumWalk(arr, isMax, state) ? (state.nan ? NaN : state.m) : undefined;
}

// The flat loops are the hot path. `Math.min` and `Math.max` compile to a branch-free instruction
// and keep a NaN. A `<` loop with a NaN test measured 2.3x slower on 1e6 numbers. They differ
// from mathjs only on the sign of a zero result, so a zero result is replaced by the first zero.
// They return `undefined` at the first element that is not a number, and the nested walk takes over.

/** The first element that equals zero (0 or -0). Called only when the result is a zero. */
function firstZero(xs: unknown[]): number {
  for (let i = 0; i < xs.length; i++) if (xs[i] === 0) return xs[i] as number;
  return 0;
}

function flatMin(xs: unknown[]): number | undefined {
  let m = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (typeof x !== 'number') return undefined;
    m = Math.min(m, x);
  }
  return m === 0 ? firstZero(xs) : m;
}

function flatMax(xs: unknown[]): number | undefined {
  let m = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (typeof x !== 'number') return undefined;
    m = Math.max(m, x);
  }
  return m === 0 ? firstZero(xs) : m;
}

/** One level of the nested walk of `numberExtremum`. */
function extremumWalk(xs: unknown[], isMax: boolean, state: { m: number; nan: boolean }): boolean {
  let m = state.m;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (typeof x === 'number') {
      if (isMax ? x > m : x < m) m = x;
      else if (x !== x) state.nan = true;
    } else if (Array.isArray(x)) {
      state.m = m;
      if (!extremumWalk(x, isMax, state)) return false;
      m = state.m;
    } else {
      return false;
    }
  }
  state.m = m;
  return true;
}

/** The numeric types that `min` and `max` compare exactly when their types differ. */
const EXTREMUM_TYPES = ['number', 'Fraction', 'BigNumber', 'bigint'] as const;

/**
 * The signatures that `min` and `max` share. Two arguments of different types go to the exact
 * function, which returns the winning argument itself. A conversion to one common type would
 * change the type of the result (`max(1, fraction(1, 3))` is the number 1).
 */
function extremumSignatures(name: 'min' | 'max'): Record<string, (...args: never[]) => unknown> {
  const isMax = name === 'max';
  const exact = (...args: unknown[]): unknown => exactReductions(name)[name](...args);
  const pick = (a: f64, b: f64): f64 =>
    a !== a || b !== b ? NaN : (isMax ? b > a : b < a) ? b : a;
  const sign = isMax ? 1 : -1;
  const signatures: Record<string, (...args: never[]) => unknown> = {
    'bigint, bigint': (a: i64, b: i64): i64 => ((isMax ? b > a : b < a) ? b : a),
    'Fraction, Fraction': (a: Fraction, b: Fraction): Fraction => (b.compare(a) * sign > 0 ? b : a),
    'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber =>
      b.compare(a) * sign > 0 ? b : a,
    number: (a: f64): f64 => a,
    Fraction: (a: Fraction): Fraction => a,
    BigNumber: (a: BigNumber): BigNumber => a,
    'number, number': pick,
    Array: (arr: unknown[]): unknown => numberExtremum(arr, isMax) ?? exact(arr),
    Matrix: (m: unknown): unknown => {
      const v = (m as { valueOf(): unknown }).valueOf();
      return (Array.isArray(v) ? numberExtremum(v, isMax) : undefined) ?? exact(m);
    },
    'Array, number | BigNumber': (arr: unknown, dim: unknown): unknown => exact(arr, dim),
    'Matrix, number | BigNumber': (m: unknown, dim: unknown): unknown => exact(m, dim),
    'number | Fraction | BigNumber | bigint, number | Fraction | BigNumber | bigint, ...number | Fraction | BigNumber | bigint':
      (a: unknown, b: unknown, rest: unknown[]): unknown => {
        if (typeof a !== 'number' || typeof b !== 'number') return exact(a, b, ...rest);
        let m = pick(a, b);
        for (let i = 0; i < rest.length; i++) {
          const x = rest[i];
          if (typeof x !== 'number') return exact(a, b, ...rest);
          m = pick(m, x);
        }
        return m;
      },

    // Float64Array, synchronous. The worker versions are parallelStatMin/Max and computePool.
    // All of the versions use the rule of core `extrema`: NaN propagates, and an equal later
    // value does not replace the first value.
    Float64Array: (a: Float64Array): f64 => (isMax ? extrema(a).max : extrema(a).min),
  };
  for (const x of EXTREMUM_TYPES) {
    for (const y of EXTREMUM_TYPES) {
      if (x !== y) signatures[`${x}, ${y}`] = (a: unknown, b: unknown): unknown => exact(a, b);
    }
  }
  return signatures;
}

/**
 * Minimum of values. The Float64Array signature is synchronous.
 */
export const min = mathTyped('min', extremumSignatures('min'));

/**
 * Maximum of values. The Float64Array signature is synchronous.
 */
export const max = mathTyped('max', extremumSignatures('max'));

// =============================================================================
// Statistical Operations
// =============================================================================

/**
 * Sum. The Float64Array signature is synchronous.
 */
/**
 * Exactly-rounded sum — the equivalent of Python's `math.fsum` / NumPy's `math.fsum` idiom.
 *
 * `sum` uses pairwise summation, which is accurate to ~machine epsilon and free. But pairwise
 * cannot recover a value that has already been annihilated by catastrophic cancellation:
 *
 *     sum([1e16, 1, -1e16])   ->  0     (so does np.sum — the 1 is lost the moment it meets 1e16)
 *     fsum([1e16, 1, -1e16])  ->  1     (exact)
 *
 * Neumaier compensation tracks the low-order bits each addition discards and folds them back in.
 * ~2-4x slower than `sum`, so it is opt-in. Reach for it when the result is a small difference of
 * large terms: conservation checks, residuals, long-running accumulators.
 */
export const fsum = mathTyped('fsum', {
  Array: (arr: f64[]): f64 => neumaierSum(numberVector('fsum', arr)),
  Float64Array: (a: Float64Array): f64 => neumaierSum(a),
});

/**
 * The pairwise sum of an array whose leaves are all numbers, at any depth. A nested array gives
 * the same bits as its flat form. Returns `undefined` when any leaf is not a number, so the
 * caller can use the exact sum.
 */
function numberSum(arr: unknown[]): number | undefined {
  const flat = pairwiseSumChecked(arr);
  if (flat !== undefined) return flat;
  const leaves = numberLeaves(arr, false);
  return leaves === undefined ? undefined : pairwiseSum(leaves);
}

export const sum = mathTyped('sum', {
  // PAIRWISE summation, not `total += arr[i]`.
  //
  // Naive accumulation lets the running total grow large while the addends stay small, so each
  // addition rounds off a bit more of the total: error grows as O(n)*eps. Measured on 1e6 copies
  // of 0.1 (exact answer 100000):
  //
  //     naive (what shipped)  relative error 1.3e-11
  //     pairwise (this)       relative error 2.9e-16   <- identical to NumPy's np.sum
  //
  // We were ~46,000x less accurate than NumPy on a bog-standard `sum`, and `mean`/`std`/`variance`
  // all inherit it. Pairwise costs the same number of additions — the naive loop was simply worse.
  // For catastrophic cancellation (e.g. [1e16, 1, -1e16], which pairwise AND np.sum both
  // annihilate to 0) use `fsum`.
  Array: (arr: unknown[]): unknown => numberSum(arr) ?? exactReductions('sum').sum(arr),
  Matrix: (m: unknown): unknown => {
    const v = (m as { valueOf(): unknown }).valueOf();
    return (Array.isArray(v) ? numberSum(v) : undefined) ?? exactReductions('sum').sum(m);
  },
  'Array, number | BigNumber': (arr: unknown, dim: unknown): unknown =>
    exactReductions('sum').sum(arr, dim),
  'Matrix, number | BigNumber': (m: unknown, dim: unknown): unknown =>
    exactReductions('sum').sum(m, dim),

  // Synchronous pairwise sum on typed arrays (no worker pool).
  Float64Array: (a: Float64Array): f64 => pairwiseSum(a),
  Float32Array: (a: Float32Array): f64 => pairwiseSum(a),
  // sum(a, b, c, ...): the values as separate arguments, as in mathjs. The array form
  // computes the result, so an exact scalar type stays exact.
  '...number | bigint | Fraction | BigNumber | Complex | Unit': (values: unknown[]): unknown =>
    sum(values) as unknown,
});

/**
 * Synchronous pairwise mean. Returns a number for `number[]`, `Float32Array` and `Float64Array`.
 * The worker-pool mean is `parallelStatMean` and returns a Promise.
 */
function meanOfNumeric(xs: ArrayLike<number>): f64 {
  const n = xs.length;
  if (n === 0) return NaN;
  return pairwiseSum(xs) / n;
}

/**
 * The data of a mean, variance or std call: a typed array or an array is itself, and a Matrix
 * gives its `toArray()` (or `valueOf()`) when that is an array. Anything else (a Fraction, BigNumber, Complex,
 * string, ...) is not data, so the caller uses the exact factory.
 */
function statData(input: unknown): ArrayLike<unknown> | undefined {
  if (input instanceof Float64Array || input instanceof Float32Array) return input;
  if (Array.isArray(input)) return input;
  if (input !== null && typeof input === 'object') {
    const o = input as { toArray?: () => unknown; valueOf(): unknown };
    const v = typeof o.toArray === 'function' ? o.toArray() : o.valueOf();
    if (Array.isArray(v)) return v;
  }
  return undefined;
}

/**
 * The number leaves of a nested array, in order, dropping NaN when `skipNaN`. `undefined` when a
 * leaf is not a number. Flat and nested input give the same leaves.
 */
function numberLeaves(xs: ArrayLike<unknown>, skipNaN: boolean): number[] | undefined {
  const out: number[] = [];
  const collect = (ys: ArrayLike<unknown>): boolean => {
    for (let i = 0; i < ys.length; i++) {
      const y = ys[i];
      if (typeof y === 'number') {
        if (!skipNaN || !Number.isNaN(y)) out.push(y);
      } else if (!Array.isArray(y) || !collect(y)) {
        return false;
      }
    }
    return true;
  };
  return collect(xs) ? out : undefined;
}

/** Mean of number data at any depth, or `undefined` for exact data. */
function meanOfData(xs: ArrayLike<unknown>): f64 | undefined {
  const flat = pairwiseSumChecked(xs);
  if (flat !== undefined) return xs.length === 0 ? NaN : flat / xs.length;
  const leaves = numberLeaves(xs, false);
  return leaves === undefined ? undefined : meanOfNumeric(leaves);
}

/** The mean of number data, or `undefined` when the data is exact. */
function meanOfInput(input: unknown, skipNaN: boolean): f64 | undefined {
  const xs = statData(input);
  if (xs === undefined) return undefined;
  if (!skipNaN) return meanOfData(xs);
  const leaves = numberLeaves(xs, true);
  return leaves === undefined ? undefined : meanOfData(leaves);
}

/**
 * True when `xs` has the shape that the number kernel reduces along a dimension: a vector of
 * numbers, or a rectangular grid of number rows. Allocates nothing.
 */
function isNumberGrid(xs: ArrayLike<unknown>): boolean {
  if (xs.length === 0 || !Array.isArray(xs[0])) {
    for (let i = 0; i < xs.length; i++) if (typeof xs[i] !== 'number') return false;
    return true;
  }
  const cols = (xs[0] as unknown[]).length;
  for (let r = 0; r < xs.length; r++) {
    const row = xs[r];
    if (!Array.isArray(row) || row.length !== cols) return false;
    for (let c = 0; c < cols; c++) if (typeof row[c] !== 'number') return false;
  }
  return true;
}

/**
 * True when `input` is number data in the shape of the number kernel. The dimension path checks
 * `input` before the dimension path reduces. Other data (exact values, 3-D or ragged arrays) goes to the factory path,
 * which reduces any number of dimensions.
 */
function isNumberData(input: unknown): boolean {
  const xs = statData(input);
  return xs !== undefined && isNumberGrid(xs);
}

function meanAlongData(
  input: unknown,
  dim: number | { valueOf(): number },
  skipNaN: boolean
): number | number[] | undefined {
  return isNumberData(input) ? reduceNumericMatrix(input, dim, skipNaN, meanOfNumeric) : undefined;
}

/**
 * The leaves of exact data at any depth, in order. With `skipNaN`, the function drops the leaves that the
 * factory `isNaN` reports.
 */
function exactLeaves(
  xs: ArrayLike<unknown>,
  skipNaN: boolean,
  isNaNOf: (x: unknown) => unknown
): unknown[] {
  const out: unknown[] = [];
  const collect = (ys: ArrayLike<unknown>): void => {
    for (let i = 0; i < ys.length; i++) {
      const y = ys[i];
      if (Array.isArray(y)) collect(y);
      else if (!skipNaN || isNaNOf(y) !== true) out.push(y);
    }
  };
  collect(xs);
  return out;
}

/** The number of array levels of `xs`, read along its first elements. */
function arrayDepth(xs: unknown): number {
  let depth = 0;
  for (let y = xs; Array.isArray(y); y = y[0]) depth++;
  return depth;
}

/** Apply `reduce` to each slice of `xs` along `dim`. The result has one level less than `xs`. */
function reduceSlices(xs: unknown[], dim: number, reduce: (slice: unknown[]) => unknown): unknown {
  if (dim > 0) return xs.map((row) => reduceSlices(row as unknown[], dim - 1, reduce));
  if (!Array.isArray(xs[0])) return reduce(xs);
  return (xs[0] as unknown[]).map((_, j) =>
    reduceSlices(
      xs.map((row) => (row as unknown[])[j]),
      0,
      reduce
    )
  );
}

/**
 * Reduce exact data for a call with an options object: the whole data, or each slice along `dim`.
 * `reduce` gets the leaves of the data or the slice, with NaN dropped when `skipNaN`.
 */
function exactWithOptions(
  name: string,
  input: unknown,
  dim: number | { valueOf(): number } | undefined,
  skipNaN: boolean,
  reduce: (leaves: unknown[]) => unknown
): unknown {
  const xs = statData(input);
  if (xs === undefined) throw new TypeError(`${name}: expected an array or a matrix`);
  const { isNaN: isNaNOf } = exactReductions(name);
  const ofLeaves = (ys: ArrayLike<unknown>): unknown => reduce(exactLeaves(ys, skipNaN, isNaNOf));
  if (dim === undefined) return ofLeaves(xs);
  const d = Number(dim.valueOf());
  const depth = arrayDepth(xs);
  if (!Number.isInteger(d) || d < 0 || d >= depth) {
    throw new RangeError(`${name}: dimension ${String(d)} is out of range for ${depth}-D data`);
  }
  return reduceSlices(Array.from(xs), d, ofLeaves);
}

/** The exact mean of `leaves`. No leaves give NaN, as on number data. */
function exactMeanOf(leaves: unknown[]): unknown {
  return leaves.length === 0 ? NaN : exactReductions('mean').mean(leaves);
}

/**
 * The exact variance of `leaves`. A `ddof` request divides the sum of squared deviations by
 * `n - ddof` and gives NaN when the divisor is not positive, as on number data.
 */
function exactVarianceOf(leaves: unknown[], request: VarianceRequest): unknown {
  const n = leaves.length;
  const ex = exactReductions('variance');
  if (request.kind === 'norm') return n === 0 ? NaN : ex.variance(leaves, request.norm);
  const divisor = n - request.ddof;
  if (divisor <= 0) return NaN;
  return ex.varianceDdof(leaves, request.ddof);
}

/** The exact variance, or with `sqrt` the standard deviation, for a call with options. */
function exactVarianceWith(
  name: 'variance' | 'std',
  input: unknown,
  dim: number | { valueOf(): number } | undefined,
  request: VarianceRequest,
  skipNaN: boolean
): unknown {
  const of =
    name === 'std'
      ? (leaves: unknown[]): unknown => exactReductions(name).sqrt(exactVarianceOf(leaves, request))
      : (leaves: unknown[]): unknown => exactVarianceOf(leaves, request);
  return exactWithOptions(name, input, dim, skipNaN, of);
}

/** The mean for a call with an options object: the number path, else the exact path. */
function meanWithOptions(
  input: unknown,
  dim: number | { valueOf(): number } | undefined,
  opts: StatReduceOptions
): number | number[] {
  const { skipNaN } = normalizationFromSecondArg(opts);
  const r = dim === undefined ? meanOfInput(input, skipNaN) : meanAlongData(input, dim, skipNaN);
  return (r ?? exactWithOptions('mean', input, dim, skipNaN, exactMeanOf)) as number | number[];
}

/**
 * The result of an exact reduction along a dimension, in the container of the number path: a
 * plain array. A matrix result becomes its array. A sparse input gives a column matrix of size
 * [n, 1]. A sparse matrix has no 1-D form, so that result becomes a 1-D array.
 */
function asAlongResult(input: unknown, result: unknown): unknown {
  const r = result as { toArray?: () => unknown[] } | null;
  if (!r || typeof r.toArray !== 'function') return result;
  const data = r.toArray();
  const sparseInput = (input as { storage?: () => string } | null)?.storage?.() === 'sparse';
  return sparseInput && data.every((row) => Array.isArray(row) && row.length === 1)
    ? data.map((row) => (row as unknown[])[0])
    : data;
}

const exactMean = (...args: unknown[]): unknown =>
  asAlongResult(args[0], exactReductions('mean').mean(...args));

export const mean = mathTyped('mean', {
  // The number keys keep `number` as their public type. Exact data is not a number, so the
  // `unknown` fallback overloads in the manifest type it; the cast marks that split.
  Array: (arr: f64[]): f64 => (meanOfInput(arr, false) ?? exactMean(arr)) as f64,
  'Array, Object': (arr: f64[], opts: StatReduceOptions): f64 =>
    meanWithOptions(arr, undefined, opts) as f64,
  'Array, number | BigNumber': (
    arr: f64[],
    dim: number | { valueOf(): number }
  ): number | number[] =>
    (meanAlongData(arr, dim, false) ?? exactMean(arr, dim)) as number | number[],
  'Array, number | BigNumber, Object': (
    arr: f64[],
    dim: number | { valueOf(): number },
    opts: StatReduceOptions
  ): number | number[] => meanWithOptions(arr, dim, opts),

  Float64Array: (a: Float64Array): f64 => meanOfNumeric(a),
  'Float64Array, Object': (a: Float64Array, opts: StatReduceOptions): f64 => {
    const { skipNaN } = normalizationFromSecondArg(opts);
    return meanOfNumeric(skipNaN ? finiteNumbers(a, true) : a);
  },
  Float32Array: (a: Float32Array): f64 => meanOfNumeric(a),
  'Float32Array, Object': (a: Float32Array, opts: StatReduceOptions): f64 => {
    const { skipNaN } = normalizationFromSecondArg(opts);
    return meanOfNumeric(skipNaN ? finiteNumbers(a, true) : a);
  },

  Matrix: (m: unknown): f64 => (meanOfInput(m, false) ?? exactMean(m)) as f64,
  'Matrix, Object': (m: unknown, opts: StatReduceOptions): f64 =>
    meanWithOptions(m, undefined, opts) as f64,
  'Matrix, number | BigNumber': (
    m: unknown,
    dim: number | { valueOf(): number }
  ): number | number[] => (meanAlongData(m, dim, false) ?? exactMean(m, dim)) as number | number[],
  'Matrix, number | BigNumber, Object': (
    m: unknown,
    dim: number | { valueOf(): number },
    opts: StatReduceOptions
  ): number | number[] => meanWithOptions(m, dim, opts),
  // mean(a, b, c, ...): the values as separate arguments, as in mathjs. The array form
  // computes the result, so an exact scalar type stays exact.
  '...number | bigint | Fraction | BigNumber | Complex | Unit': (values: unknown[]): f64 =>
    mean(values) as f64,
}) as PublicMean;

/**
 * Variance normalization, matching mathjs's `variance(array, normalization)`:
 *   - 'unbiased'    → sum2 / (n - 1)   (sample variance; mathjs DEFAULT)
 *   - 'uncorrected' → sum2 / n         (population variance)
 *   - 'biased'      → sum2 / (n + 1)
 */
export type VarNormalization = 'unbiased' | 'uncorrected' | 'biased';

/** Normalize a precomputed sum of squared deviations (`m2`) by the chosen convention. */
function varianceFromM2(m2: f64, n: i32, norm: VarNormalization): f64 {
  if (n === 0) return NaN;
  switch (norm) {
    case 'biased':
      return m2 / (n + 1);
    case 'uncorrected':
      return m2 / n;
    case 'unbiased':
      // mathjs returns 0 (not NaN) for a single value under the unbiased string.
      return n > 1 ? m2 / (n - 1) : 0;
    default:
      throw new TypeError(
        `Unknown normalization "${String(norm)}". Choose "unbiased" (default), "uncorrected", or "biased".`
      );
  }
}

/** NumPy divisor `n - ddof`. `NaN` when `ddof >= n` (degrees of freedom exhausted). */
function varianceFromDdof(m2: f64, n: i32, ddof: number): f64 {
  if (n === 0 || n <= ddof) return NaN;
  return m2 / (n - ddof);
}

function varianceFromSum(m2: f64, n: i32, request: VarianceRequest): f64 {
  return request.kind === 'ddof'
    ? varianceFromDdof(m2, n, request.ddof)
    : varianceFromM2(m2, n, request.norm);
}

/** Variance of a number vector (no NaN handling; the caller filters). */
function varianceOf(xs: ArrayLike<number>, request: VarianceRequest): f64 {
  const n = xs.length;
  return varianceFromSum(n < 2 ? 0 : sumSquaredDeviations(xs), n, request);
}

/** Variance of number data at any depth, or `undefined` for exact data. */
function varianceOfData(xs: ArrayLike<unknown>, request: VarianceRequest): f64 | undefined {
  const m2 = sumSquaredDeviationsChecked(xs);
  if (m2 !== undefined) return varianceFromSum(m2, xs.length, request);
  const leaves = numberLeaves(xs, false);
  return leaves === undefined ? undefined : varianceOf(leaves, request);
}

/** The variance of number data, or `undefined` when the data is exact. */
function varianceWith(input: unknown, request: VarianceRequest, skipNaN: boolean): f64 | undefined {
  const xs = statData(input);
  if (xs === undefined) return undefined;
  if (!skipNaN) return varianceOfData(xs, request);
  const leaves = numberLeaves(xs, true);
  return leaves === undefined ? undefined : varianceOfData(leaves, request);
}

function varianceAlong(
  input: unknown,
  dim: number | { valueOf(): number },
  request: VarianceRequest,
  skipNaN: boolean
): number | number[] {
  return reduceNumericMatrix(input, dim, skipNaN, (xs) => varianceOf(xs, request));
}

function varianceAlongData(
  input: unknown,
  dim: number | { valueOf(): number },
  request: VarianceRequest,
  skipNaN: boolean
): number | number[] | undefined {
  return isNumberData(input) ? varianceAlong(input, dim, request, skipNaN) : undefined;
}

const UNBIASED: VarianceRequest = { kind: 'norm', norm: 'unbiased' };

const exactVariance = (...args: unknown[]): unknown =>
  asAlongResult(args[0], exactReductions('variance').variance(...args));

/**
 * Variance. The Float64Array signature is synchronous.
 *
 * Defaults to **unbiased** (sample, ÷(n-1)) to match mathjs and the
 * `parallelStatVariance` variant. An optional normalization argument selects
 * 'unbiased' | 'uncorrected' (population) | 'biased'. See VarNormalization.
 */
export const variance = mathTyped('variance', {
  Array: (arr: f64[]): f64 => (varianceWith(arr, UNBIASED, false) ?? exactVariance(arr)) as f64,
  'Array, string': (arr: f64[], norm: string): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(norm);
    return (varianceWith(arr, request, skipNaN) ?? exactVariance(arr, norm)) as f64;
  },
  'Array, Object': (arr: f64[], arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return (varianceWith(arr, request, skipNaN) ??
      exactVarianceWith('variance', arr, undefined, request, skipNaN)) as f64;
  },
  'Array, string, Object': (arr: f64[], norm: string, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromStringAndOptions(norm, arg);
    return (varianceWith(arr, request, skipNaN) ??
      exactVarianceWith('variance', arr, undefined, request, skipNaN)) as f64;
  },
  'Array, number | BigNumber': (
    arr: f64[],
    dim: number | { valueOf(): number }
  ): number | number[] =>
    (varianceAlongData(arr, dim, UNBIASED, false) ?? exactVariance(arr, dim)) as number | number[],
  'Array, number | BigNumber, string': (
    arr: f64[],
    dim: number | { valueOf(): number },
    norm: string
  ): number | number[] => {
    const { request } = normalizationFromSecondArg(norm);
    return (varianceAlongData(arr, dim, request, false) ?? exactVariance(arr, dim, norm)) as
      number | number[];
  },
  'Array, number | BigNumber, Object': (
    arr: f64[],
    dim: number | { valueOf(): number },
    arg: StatReduceOptions
  ): number | number[] => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return (varianceAlongData(arr, dim, request, skipNaN) ??
      exactVarianceWith('variance', arr, dim, request, skipNaN)) as number | number[];
  },

  Float64Array: (a: Float64Array): f64 => varianceOf(a, UNBIASED),
  Float32Array: (a: Float32Array): f64 => varianceOf(a, UNBIASED),
  'Float64Array, string': (a: Float64Array, norm: string): f64 => {
    const { request } = normalizationFromSecondArg(norm);
    return varianceOf(a, request);
  },
  'Float32Array, string': (a: Float32Array, norm: string): f64 => {
    const { request } = normalizationFromSecondArg(norm);
    return varianceOf(a, request);
  },
  'Float64Array, Object': (a: Float64Array, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return varianceOf(skipNaN ? finiteNumbers(a, true) : a, request);
  },
  'Float32Array, Object': (a: Float32Array, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return varianceOf(skipNaN ? finiteNumbers(a, true) : a, request);
  },
  'Float64Array, string, Object': (a: Float64Array, norm: string, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromStringAndOptions(norm, arg);
    return varianceOf(skipNaN ? finiteNumbers(a, true) : a, request);
  },
  'Float32Array, string, Object': (a: Float32Array, norm: string, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromStringAndOptions(norm, arg);
    return varianceOf(skipNaN ? finiteNumbers(a, true) : a, request);
  },

  Matrix: (m: unknown): f64 => (varianceWith(m, UNBIASED, false) ?? exactVariance(m)) as f64,
  'Matrix, string': (m: unknown, norm: string): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(norm);
    return (varianceWith(m, request, skipNaN) ?? exactVariance(m, norm)) as f64;
  },
  'Matrix, Object': (m: unknown, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return (varianceWith(m, request, skipNaN) ??
      exactVarianceWith('variance', m, undefined, request, skipNaN)) as f64;
  },
  'Matrix, string, Object': (m: unknown, norm: string, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromStringAndOptions(norm, arg);
    return (varianceWith(m, request, skipNaN) ??
      exactVarianceWith('variance', m, undefined, request, skipNaN)) as f64;
  },
  'Matrix, number | BigNumber': (
    m: unknown,
    dim: number | { valueOf(): number }
  ): number | number[] =>
    (varianceAlongData(m, dim, UNBIASED, false) ?? exactVariance(m, dim)) as number | number[],
  'Matrix, number | BigNumber, string': (
    m: unknown,
    dim: number | { valueOf(): number },
    norm: string
  ): number | number[] => {
    const { request } = normalizationFromSecondArg(norm);
    return (varianceAlongData(m, dim, request, false) ?? exactVariance(m, dim, norm)) as
      number | number[];
  },
  'Matrix, number | BigNumber, Object': (
    m: unknown,
    dim: number | { valueOf(): number },
    arg: StatReduceOptions
  ): number | number[] => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return (varianceAlongData(m, dim, request, skipNaN) ??
      exactVarianceWith('variance', m, dim, request, skipNaN)) as number | number[];
  },
  // variance(a, b, c, ...): the values as separate arguments, as in mathjs. The array form
  // computes the result, so an exact scalar type stays exact.
  '...number | bigint | Fraction | BigNumber | Complex | Unit': (values: unknown[]): f64 =>
    variance(values) as f64,
}) as PublicVariance;

/**
 * Standard deviation. The Float64Array signature is synchronous — sqrt of {@link variance};
 * defaults to **unbiased** and accepts the same normalization argument.
 */
function stdOf(value: number | number[]): number | number[] {
  return Array.isArray(value) ? value.map((v) => Math.sqrt(v)) : Math.sqrt(value);
}

function sqrtNumber(v: f64 | undefined): f64 | undefined {
  return v === undefined ? undefined : Math.sqrt(v);
}

function stdAlongData(
  input: unknown,
  dim: number | { valueOf(): number },
  request: VarianceRequest,
  skipNaN: boolean
): number | number[] | undefined {
  const v = varianceAlongData(input, dim, request, skipNaN);
  return v === undefined ? undefined : stdOf(v);
}

/**
 * The square root of an exact variance. A Fraction gives a number. An array or Matrix maps the
 * same rule over its elements. Anything else (number, BigNumber, Complex) uses the exact sqrt.
 */
function exactSqrt(v: unknown): unknown {
  if (Array.isArray(v)) return v.map((x: unknown) => exactSqrt(x));
  if (v instanceof Fraction) return Math.sqrt(v.valueOf());
  const shaped = v as { map?: unknown; size?: unknown } | null;
  if (shaped && typeof shaped.map === 'function' && typeof shaped.size === 'function') {
    return (v as { map(fn: (x: unknown) => unknown): unknown }).map((x) => exactSqrt(x));
  }
  return exactReductions('std').sqrt(v);
}

const exactStd = (...args: unknown[]): unknown => exactSqrt(exactVariance(...args));

/**
 * The standard deviation: the square root of `variance`, with the same arguments. Number data
 * gives a number. BigNumber and Complex data give their own type. Fraction data gives a number,
 * because the square root of a fraction is not a fraction in general.
 */
export const std = mathTyped('std', {
  Array: (arr: f64[]): f64 =>
    (sqrtNumber(varianceWith(arr, UNBIASED, false)) ?? exactStd(arr)) as f64,
  'Array, string': (arr: f64[], norm: string): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(norm);
    return (sqrtNumber(varianceWith(arr, request, skipNaN)) ?? exactStd(arr, norm)) as f64;
  },
  'Array, Object': (arr: f64[], arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return (sqrtNumber(varianceWith(arr, request, skipNaN)) ??
      exactVarianceWith('std', arr, undefined, request, skipNaN)) as f64;
  },
  'Array, string, Object': (arr: f64[], norm: string, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromStringAndOptions(norm, arg);
    return (sqrtNumber(varianceWith(arr, request, skipNaN)) ??
      exactVarianceWith('std', arr, undefined, request, skipNaN)) as f64;
  },
  'Array, number | BigNumber': (
    arr: f64[],
    dim: number | { valueOf(): number }
  ): number | number[] =>
    (stdAlongData(arr, dim, UNBIASED, false) ?? exactStd(arr, dim)) as number | number[],
  'Array, number | BigNumber, string': (
    arr: f64[],
    dim: number | { valueOf(): number },
    norm: string
  ): number | number[] => {
    const { request } = normalizationFromSecondArg(norm);
    return (stdAlongData(arr, dim, request, false) ?? exactStd(arr, dim, norm)) as
      number | number[];
  },
  'Array, number | BigNumber, Object': (
    arr: f64[],
    dim: number | { valueOf(): number },
    arg: StatReduceOptions
  ): number | number[] => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return (stdAlongData(arr, dim, request, skipNaN) ??
      exactVarianceWith('std', arr, dim, request, skipNaN)) as number | number[];
  },

  Float64Array: (a: Float64Array): f64 => Math.sqrt(varianceOf(a, UNBIASED)),
  Float32Array: (a: Float32Array): f64 => Math.sqrt(varianceOf(a, UNBIASED)),
  'Float64Array, string': (a: Float64Array, norm: string): f64 => {
    const { request } = normalizationFromSecondArg(norm);
    return Math.sqrt(varianceOf(a, request));
  },
  'Float32Array, string': (a: Float32Array, norm: string): f64 => {
    const { request } = normalizationFromSecondArg(norm);
    return Math.sqrt(varianceOf(a, request));
  },
  'Float64Array, Object': (a: Float64Array, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return Math.sqrt(varianceOf(skipNaN ? finiteNumbers(a, true) : a, request));
  },
  'Float32Array, Object': (a: Float32Array, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return Math.sqrt(varianceOf(skipNaN ? finiteNumbers(a, true) : a, request));
  },
  'Float64Array, string, Object': (a: Float64Array, norm: string, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromStringAndOptions(norm, arg);
    return Math.sqrt(varianceOf(skipNaN ? finiteNumbers(a, true) : a, request));
  },
  'Float32Array, string, Object': (a: Float32Array, norm: string, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromStringAndOptions(norm, arg);
    return Math.sqrt(varianceOf(skipNaN ? finiteNumbers(a, true) : a, request));
  },

  Matrix: (m: unknown): f64 => (sqrtNumber(varianceWith(m, UNBIASED, false)) ?? exactStd(m)) as f64,
  'Matrix, string': (m: unknown, norm: string): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(norm);
    return (sqrtNumber(varianceWith(m, request, skipNaN)) ?? exactStd(m, norm)) as f64;
  },
  'Matrix, Object': (m: unknown, arg: StatReduceOptions): f64 => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return (sqrtNumber(varianceWith(m, request, skipNaN)) ??
      exactVarianceWith('std', m, undefined, request, skipNaN)) as f64;
  },
  'Matrix, number | BigNumber': (
    m: unknown,
    dim: number | { valueOf(): number }
  ): number | number[] =>
    (stdAlongData(m, dim, UNBIASED, false) ?? exactStd(m, dim)) as number | number[],
  'Matrix, number | BigNumber, string': (
    m: unknown,
    dim: number | { valueOf(): number },
    norm: string
  ): number | number[] => {
    const { request } = normalizationFromSecondArg(norm);
    return (stdAlongData(m, dim, request, false) ?? exactStd(m, dim, norm)) as number | number[];
  },
  'Matrix, number | BigNumber, Object': (
    m: unknown,
    dim: number | { valueOf(): number },
    arg: StatReduceOptions
  ): number | number[] => {
    const { request, skipNaN } = normalizationFromSecondArg(arg);
    return (stdAlongData(m, dim, request, skipNaN) ??
      exactVarianceWith('std', m, dim, request, skipNaN)) as number | number[];
  },
  // std(a, b, c, ...): the values as separate arguments, as in mathjs. The array form
  // computes the result, so an exact scalar type stays exact.
  '...number | bigint | Fraction | BigNumber | Complex | Unit': (values: unknown[]): f64 =>
    std(values) as f64,
}) as PublicStd;

type NanReduce = (
  x: NumericVectorInput | number[][],
  dimOrOpts?: number | StatReduceOptions,
  opts?: StatReduceOptions
) => number | number[];

/** `mean` with NaN omitted (`numpy.nanmean`). A `dim` reduces along that axis. */
export function nanmean(x: NumericVectorInput | number[][], dim?: number): number | number[] {
  const call = mean as NanReduce;
  if (dim === undefined) return call(x, { skipNaN: true }) as number;
  return call(x, dim, { skipNaN: true }) as number | number[];
}

/** `variance` with NaN omitted (`numpy.nanvar`, default sample `ddof=1`). */
export function nanvariance(
  x: NumericVectorInput | number[][],
  ddof: number = 1,
  dim?: number
): number | number[] {
  const call = variance as NanReduce;
  if (dim === undefined) return call(x, { skipNaN: true, ddof }) as number;
  return call(x, dim, { skipNaN: true, ddof }) as number | number[];
}

/** `std` with NaN omitted (`numpy.nanstd`, default sample `ddof=1`). */
export function nanstd(
  x: NumericVectorInput | number[][],
  ddof: number = 1,
  dim?: number
): number | number[] {
  const call = std as NanReduce;
  if (dim === undefined) return call(x, { skipNaN: true, ddof }) as number;
  return call(x, dim, { skipNaN: true, ddof }) as number | number[];
}

/**
 * The pairwise dot product of two arrays whose elements are all numbers, or `undefined` when an
 * element of either is not a number (an exact value, a bigint, a string, a nested array). The
 * caller then uses the exact dot.
 */
function numberDot(a: unknown[], b: unknown[]): f64 | undefined {
  checkDotLengths(a.length, b.length);
  const r = pairwiseDotChecked(a, b);
  return r === 0 ? signedZeroDot(a as number[], b as number[]) : r;
}

/** Throw the mathjs `RangeError` for vectors of different length or empty vectors. */
function checkDotLengths(na: number, nb: number): void {
  if (na !== nb) throw new RangeError(`Vectors must have equal length (${na} != ${nb})`);
  if (na === 0) throw new RangeError('Cannot calculate the dot product of empty vectors');
}

/**
 * The sign of a zero dot product. A sum is -0 only when every term is -0, as in the naive loop of
 * mathjs; the pairwise kernel starts its accumulators at +0. This check runs only for a zero result.
 */
function signedZeroDot(a: ArrayLike<number>, b: ArrayLike<number>): f64 {
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i] * b[i], -0)) return 0;
  return -0;
}

/**
 * Dot product. The Float64Array signature is synchronous. Number vectors take the pairwise kernel;
 * exact data, bigints and nested arrays take the factory dot, which follows mathjs.
 */
export const dot = mathTyped('dot', {
  'Array, Array': (a: unknown[], b: unknown[]): unknown =>
    numberDot(a, b) ?? exactReductions('dot').dot(a, b),

  // A Matrix gives its data when that is a flat array of numbers, else the factory dot.
  'Matrix, Matrix': (a: unknown, b: unknown): unknown => {
    const va = (a as { valueOf(): unknown }).valueOf();
    const vb = (b as { valueOf(): unknown }).valueOf();
    return (
      (Array.isArray(va) && Array.isArray(vb) ? numberDot(va, vb) : undefined) ??
      exactReductions('dot').dot(a, b)
    );
  },
  'Matrix, Array': (a: unknown, b: unknown[]): unknown => {
    const va = (a as { valueOf(): unknown }).valueOf();
    return (Array.isArray(va) ? numberDot(va, b) : undefined) ?? exactReductions('dot').dot(a, b);
  },
  'Array, Matrix': (a: unknown[], b: unknown): unknown => {
    const vb = (b as { valueOf(): unknown }).valueOf();
    return (Array.isArray(vb) ? numberDot(a, vb) : undefined) ?? exactReductions('dot').dot(a, b);
  },

  // Float64Array dot product (synchronous, pairwise summation)
  'Float64Array, Float64Array': (a: Float64Array, b: Float64Array): f64 => {
    checkDotLengths(a.length, b.length);
    const r = pairwiseDot(a, b);
    return r === 0 ? signedZeroDot(a, b) : r;
  },
});

// =============================================================================
// Matrix Operations
// =============================================================================

/**
 * Matrix multiplication of row-major Float64Arrays: A (aRows x aCols) times B (aCols x bCols).
 * Synchronous at every size (`matmulSequential`). For worker threads above the measured
 * break-even, use `computePool.matmul` from `@danielsimonjr/mathts-parallel`.
 * @param a First matrix as flat Float64Array (row-major)
 * @param aRows Number of rows in A
 * @param aCols Number of columns in A (must equal bRows)
 * @param b Second matrix as flat Float64Array (row-major)
 * @param bCols Number of columns in B
 * @throws Error when `a` or `b` does not hold the elements that its shape gives
 */
export function matmul(
  a: Float64Array,
  aRows: i32,
  aCols: i32,
  b: Float64Array,
  bCols: i32
): Float64Array {
  return matmulSequential(a, aRows, aCols, b, bCols);
}

/**
 * Transpose. With `rows` and `cols`, `data` is a row-major `rows x cols` Float64Array and the
 * result is a new `cols x rows` Float64Array. With one argument, `data` is a matrix or a nested
 * array, and the result has the same storage, as in mathjs.
 * @throws Error when a Float64Array does not hold rows*cols elements
 */
export function transpose(data: Float64Array, rows: i32, cols: i32): Float64Array;
export function transpose<T>(data: readonly (readonly T[])[]): T[][];
export function transpose<T>(data: readonly T[]): T[];
export function transpose(data: unknown): unknown;
export function transpose(data: unknown, rows?: i32, cols?: i32): unknown {
  if (rows === undefined && cols === undefined) {
    if (ArrayBuffer.isView(data)) {
      throw new TypeError(
        'transpose: a typed array needs rows and cols: transpose(data, rows, cols)'
      );
    }
    // A matrix of the matrix package has its own transpose, which keeps its class.
    if (isDenseMatrix(data) || isSparseMatrix(data)) return data.transpose();
    return exactReductions('transpose').transpose(data);
  }
  if (typeof rows !== 'number' || typeof cols !== 'number') {
    throw new TypeError('transpose: pass one matrix, or data, rows and cols');
  }
  return transposeFlat(data as Float64Array, rows, cols);
}

function transposeFlat(data: Float64Array, rows: i32, cols: i32): Float64Array {
  if (data.length !== rows * cols) {
    throw new Error(`transpose: data length ${data.length} !== rows*cols (${rows * cols})`);
  }
  const out = new Float64Array(rows * cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) out[j * rows + i] = data[i * cols + j];
  }
  return out;
}

/**
 * Matrix-vector product of a row-major `rows x cols` matrix and a vector of length cols.
 * @throws Error when the matrix or the vector length does not match the shape
 */
export function matvec(
  matrix: Float64Array,
  rows: i32,
  cols: i32,
  vector: Float64Array
): Float64Array {
  if (matrix.length !== rows * cols) {
    throw new Error(`matvec: matrix length ${matrix.length} !== rows*cols (${rows * cols})`);
  }
  if (vector.length !== cols) {
    throw new Error(`matvec: vector length ${vector.length} !== cols (${cols})`);
  }
  const out = new Float64Array(rows);
  for (let i = 0; i < rows; i++) {
    let s = 0;
    for (let j = 0; j < cols; j++) s += matrix[i * cols + j] * vector[j];
    out[i] = s;
  }
  return out;
}

/**
 * Outer product of two vectors: a row-major `a.length x b.length` matrix.
 */
export function outer(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(a.length * b.length);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i * b.length + j] = a[i] * b[j];
  }
  return out;
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
