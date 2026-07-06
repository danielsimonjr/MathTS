/**
 * @danielsimonjr/mathts-compat - mathjs Compatibility Layer
 *
 * Provides a mathjs-compatible API for gradual migration to MathTS.
 *
 * @example
 * ```typescript
 * import { create, all } from '@danielsimonjr/mathts-compat';
 * const math = create(all);
 *
 * // Use mathjs-style API
 * math.add(1, 2);
 * math.complex(3, 4);
 * math.matrix([[1,2],[3,4]]);
 * ```
 *
 * @packageDocumentation
 */

import { shims } from './shims.js';
import { createChain, type Chain } from './chain.js';
import * as mathFunctions from '@danielsimonjr/mathts-functions';

// =============================================================================
// Configuration
// =============================================================================

/**
 * mathjs-compatible configuration interface
 */
export interface MathJSConfig {
  /** Numeric precision for BigNumber (default: 64) */
  precision?: number;
  /** Matrix type: 'Matrix' or 'Array' */
  matrix?: 'Matrix' | 'Array';
  /** Number type for parsing */
  number?: 'number' | 'BigNumber' | 'Fraction';
  /** Epsilon for floating point comparisons */
  epsilon?: number;
  /** Predictable random seed */
  randomSeed?: string | null;
}

/**
 * Default configuration
 */
const defaultConfig: MathJSConfig = {
  precision: 64,
  matrix: 'Matrix',
  number: 'number',
  epsilon: 1e-12,
  randomSeed: null,
};

// =============================================================================
// Math Instance
// =============================================================================

/**
 * MathTS instance with mathjs-compatible API
 */
export interface MathInstance {
  /**
   * Index signature for the full functions namespace surfaced by
   * `create(all)`. Members declared explicitly below keep their precise
   * types; everything else (det, integrate, eigs, …) is reachable as
   * `unknown` and can be narrowed by the caller.
   */
  [name: string]: unknown;

  /** Fluent chain: `math.chain(x).add(3).done()`. */
  chain: (value: unknown) => Chain;

  // Configuration
  config: (newConfig?: Partial<MathJSConfig>) => MathJSConfig;

  // Type creation
  complex: typeof shims.complex;
  fraction: typeof shims.fraction;
  bignumber: typeof shims.bignumber;
  matrix: typeof shims.matrix;
  sparse: typeof shims.sparse;

  // Arithmetic
  add: typeof shims.add;
  subtract: typeof shims.subtract;
  multiply: typeof shims.multiply;
  divide: typeof shims.divide;
  pow: typeof shims.pow;
  sqrt: typeof shims.sqrt;
  abs: typeof shims.abs;
  exp: typeof shims.exp;
  log: typeof shims.log;

  // Trigonometry
  sin: typeof shims.sin;
  cos: typeof shims.cos;
  tan: typeof shims.tan;
  asin: typeof shims.asin;
  acos: typeof shims.acos;
  atan: typeof shims.atan;
  atan2: typeof shims.atan2;

  // Statistics
  sum: typeof shims.sum;
  mean: typeof shims.mean;
  std: typeof shims.std;
  variance: typeof shims.variance;
  min: typeof shims.min;
  max: typeof shims.max;

  // Number theory
  gcd: typeof shims.gcd;
  lcm: typeof shims.lcm;

  // Rounding
  round: typeof shims.round;
  floor: typeof shims.floor;
  ceil: typeof shims.ceil;

  // Complex-specific
  conj: typeof shims.conj;
  re: typeof shims.re;
  im: typeof shims.im;
  arg: typeof shims.arg;

  // Matrix-specific
  transpose: typeof shims.transpose;
  det: typeof shims.det;
  identity: typeof shims.identity;
  zeros: typeof shims.zeros;
  ones: typeof shims.ones;
  size: typeof shims.size;

  // Type checking
  isComplex: typeof shims.isComplex;
  isFraction: typeof shims.isFraction;
  isBigNumber: typeof shims.isBigNumber;
  isNumber: typeof shims.isNumber;
  isMatrix: typeof shims.isMatrix;

  // Constants
  i: typeof shims.i;
  pi: typeof shims.pi;
  e: typeof shims.e;
  phi: typeof shims.phi;
  tau: typeof shims.tau;
  LN2: typeof shims.LN2;
  LN10: typeof shims.LN10;
  LOG2E: typeof shims.LOG2E;
  LOG10E: typeof shims.LOG10E;
  SQRT2: typeof shims.SQRT2;
  SQRT1_2: typeof shims.SQRT1_2;
  Infinity: typeof shims.Infinity;
  NaN: typeof shims.NaN;
}

/**
 * Create a MathTS instance with mathjs-compatible API
 *
 * @param factories - Factory functions to include (use `all` for the full
 *   `@danielsimonjr/mathts-functions` surface; defaults to `all`)
 * @param config - Configuration options
 * @returns MathTS instance with mathjs-compatible API
 *
 * @example
 * ```typescript
 * import { create, all } from '@danielsimonjr/mathts-compat';
 * const math = create(all);
 *
 * math.add(1, 2);             // 3
 * math.complex(3, 4);         // Complex(3, 4)
 * math.matrix([[1,2],[3,4]]); // DenseMatrix
 * math.det([[1,2],[3,4]]);    // -2  (full functions surface)
 * ```
 */
export function create(
  factories: Record<string, unknown> = all,
  config: Partial<MathJSConfig> = {}
): MathInstance {
  const currentConfig: MathJSConfig = { ...defaultConfig, ...config };
  // Push this instance's initial overrides into the shared functions config so
  // they take effect immediately (the functions surface is a process singleton).
  if (Object.keys(config).length > 0) {
    mathFunctions.config(config as Partial<MathJSConfig>);
  }

  const instance: MathInstance = {
    // Full @danielsimonjr/mathts-functions namespace — det, integrate, eigs,
    // simplify, and the rest. The compat-specific shims below overlay it.
    ...factories,

    // Configuration — forwards to the shared functions runtime config so it
    // actually DRIVES behavior (e.g. `config({ matrix: 'Array' })` changes the
    // return type of matrix-producing ops). `currentConfig` mirrors it for the
    // read path and seeds the functions config with this instance's overrides.
    config: (newConfig?: Partial<MathJSConfig>) => {
      const merged = mathFunctions.config(newConfig as Partial<MathJSConfig>);
      Object.assign(currentConfig, merged);
      return { ...currentConfig };
    },

    // Type creation
    complex: shims.complex,
    fraction: shims.fraction,
    bignumber: shims.bignumber,
    matrix: shims.matrix,
    sparse: shims.sparse,

    // Arithmetic
    add: shims.add,
    subtract: shims.subtract,
    multiply: shims.multiply,
    divide: shims.divide,
    pow: shims.pow,
    sqrt: shims.sqrt,
    abs: shims.abs,
    exp: shims.exp,
    log: shims.log,

    // Trigonometry
    sin: shims.sin,
    cos: shims.cos,
    tan: shims.tan,
    asin: shims.asin,
    acos: shims.acos,
    atan: shims.atan,
    atan2: shims.atan2,

    // Statistics
    sum: shims.sum,
    mean: shims.mean,
    std: shims.std,
    variance: shims.variance,
    min: shims.min,
    max: shims.max,

    // Number theory
    gcd: shims.gcd,
    lcm: shims.lcm,

    // Rounding
    round: shims.round,
    floor: shims.floor,
    ceil: shims.ceil,

    // Complex-specific
    conj: shims.conj,
    re: shims.re,
    im: shims.im,
    arg: shims.arg,

    // Matrix-specific
    transpose: shims.transpose,
    det: shims.det,
    identity: shims.identity,
    zeros: shims.zeros,
    ones: shims.ones,
    size: shims.size,

    // Type checking
    isComplex: shims.isComplex,
    isFraction: shims.isFraction,
    isBigNumber: shims.isBigNumber,
    isNumber: shims.isNumber,
    isMatrix: shims.isMatrix,

    // Constants
    i: shims.i,
    pi: shims.pi,
    e: shims.e,
    phi: shims.phi,
    tau: shims.tau,
    LN2: shims.LN2,
    LN10: shims.LN10,
    LOG2E: shims.LOG2E,
    LOG10E: shims.LOG10E,
    SQRT2: shims.SQRT2,
    SQRT1_2: shims.SQRT1_2,
    Infinity: shims.Infinity,
    NaN: shims.NaN,

    // Placeholder; rebound below once `instance` exists so chain methods can
    // resolve against the full surfaced namespace.
    chain: (() => {
      throw new Error('chain not initialized');
    }) as MathInstance['chain'],
  };

  // GC12 — fluent chain API (math.chain(x).add(3).done()).
  instance.chain = createChain(instance as Record<string, unknown>);

  return instance;
}

/**
 * All available factory functions
 *
 * Use with `create(all)` to get a fully-featured math instance.
 */
export const all: Record<string, unknown> = {
  ...(mathFunctions as unknown as Record<string, unknown>),
};

// =============================================================================
// Re-exports for direct use
// =============================================================================

// Re-export all shims for direct import
export * from './shims.js';

// Re-export core types
export {
  Complex,
  Fraction,
  BigNumber,
  I,
  COMPLEX_ZERO,
  COMPLEX_ONE,
  FRACTION_ZERO,
  FRACTION_ONE,
  BIGNUMBER_ZERO,
  BIGNUMBER_ONE,
  BIGNUMBER_PI,
  BIGNUMBER_E,
} from '@danielsimonjr/mathts-core';

// Re-export matrix types
export { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';

// Re-export parallel utilities
export { computePool } from '@danielsimonjr/mathts-parallel';
