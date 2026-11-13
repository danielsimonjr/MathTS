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
import { UNARY_NUMBER_FAST_PATH, type UnaryNumberFastPath } from './unary-fast-path.js';
import { createChain, type Chain } from './chain.js';
import { wireMathjsInstanceApi, type WiredCompatInstance } from './instance-api.js';
import * as mathFunctions from '@danielsimonjr/mathts-functions';

// =============================================================================
// Configuration
// =============================================================================

/**
 * The shared functions runtime config that `config()` forwards to and merges back.
 */
type RuntimeConfig = ReturnType<typeof mathFunctions.config>;

/**
 * mathjs-compatible configuration interface.
 *
 * Every runtime key is here (`relTol`, `absTol`, `numberFallback`, `predictable`,
 * `legacySubset`, ...), because `config()` returns the merged functions config: a
 * narrower type hid keys the returned object always carries.
 */
export interface MathJSConfig extends Partial<RuntimeConfig> {
  /** Numeric precision for BigNumber (default: 64) */
  precision?: number;
  /** Matrix type: 'Matrix' or 'Array' */
  matrix?: 'Matrix' | 'Array';
  /** Number type for parsing */
  number?: RuntimeConfig['number'];
  /** Epsilon for floating point comparisons (mathjs < 13; superseded by `relTol`) */
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

/** When false, wrapped calls skip `runWithConfig` (instance config unchanged since create). */
function instanceConfigUsesOverlay(current: MathJSConfig, baseline: MathJSConfig): boolean {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]) as Set<
    keyof MathJSConfig
  >;
  for (const key of keys) {
    const a = current[key];
    const b = baseline[key];
    if (a !== b && !(a === undefined && b === undefined)) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// Math Instance
// =============================================================================

/**
 * MathTS instance with mathjs-compatible API
 */
interface MathInstanceOverrides {
  /** Fluent chain: `math.chain(x).add(3).done()`. */
  chain: (value: unknown) => Chain;

  // Configuration
  config: (newConfig?: Partial<MathJSConfig>) => MathJSConfig;

  /** mathjs extension API — register functions visible to `evaluate`. */
  import: (
    functions: unknown,
    options?: { override?: boolean; silent?: boolean; wrap?: boolean }
  ) => void;
  /** mathjs typed-function dispatcher for custom overloads, with the whole `mathTyped` registry surface. */
  typed: WiredCompatInstance['typed'];
  /** Alias of `compileExpr` (mathjs naming). */
  compile: (
    expr: string,
    options?: { unsafe?: boolean; physics?: boolean; charge?: 'unit' | 'scalar' }
  ) => {
    evaluate(scope?: Record<string, unknown>): unknown;
  };
  evaluate: (
    expr: string,
    scope?: Record<string, unknown>,
    options?: { unsafe?: boolean; physics?: boolean; charge?: 'unit' | 'scalar' }
  ) => unknown;
  reviver: (key: string, value: unknown) => unknown;
  replacer: (key: string, value: unknown) => unknown;
  subset: (...args: unknown[]) => unknown;
  index: (...args: unknown[]) => unknown;
  unit: (...args: unknown[]) => unknown;

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
 * The compat instance: every export of the functions namespace (`create(all)` surfaces
 * them all) with the compat-specific members above taking precedence. No index signature.
 */
export type MathInstance = Omit<typeof mathFunctions, keyof MathInstanceOverrides> &
  MathInstanceOverrides;

/** Per-instance forwarder (unique identity, no config wrapper overhead). */
function bindShim<T extends (...args: unknown[]) => unknown>(fn: T): T {
  const bound = ((...args: unknown[]) => fn(...args)) as T;
  copyFunctionSurface(fn, bound);
  return bound;
}

/** Hot scalar ops skip lazy config wrappers (#735); still per-instance refs. */
const HOT_SCALAR_SHIM_KEYS = new Set(['add', 'subtract', 'multiply']);

/**
 * Front for a unary scalar shim (#889): a lone number in the real domain takes the Math
 * fast path (the table in shims.ts) and skips the config wrapper. Config only reaches the
 * other argument types (BigNumber precision, Complex, Unit, matrices).
 */
function withNumberFront(
  raw: (...args: unknown[]) => unknown,
  fp: UnaryNumberFastPath,
  configured: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  const front = function (this: unknown, x?: unknown) {
    if (arguments.length === 1 && typeof x === 'number' && fp.inReal(x)) {
      return fp.fastNumber(x);
    }
    return configured.apply(this, arguments as unknown as unknown[]);
  };
  copyFunctionSurface(raw, front);
  return front;
}

/**
 * Copies the name, length, prototype and own properties of `from` onto the wrapper `to`.
 * Keys that refuse redefinition stay as they are.
 */
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
  const proto = Object.getOwnPropertyDescriptor(from, 'prototype');
  if (proto) {
    try {
      Object.defineProperty(to, 'prototype', proto);
    } catch {
      try {
        (to as { prototype: unknown }).prototype = (from as { prototype: unknown }).prototype;
      } catch {
        // class `.prototype` can be non-writable; instanceof still works if
        // Reflect.construct uses `from` as newTarget when the wrapper is used.
      }
    }
  }
  for (const key of Reflect.ownKeys(from)) {
    if (key === 'length' || key === 'name' || key === 'prototype') continue;
    if (Object.prototype.hasOwnProperty.call(to, key)) continue;
    const desc = Object.getOwnPropertyDescriptor(from, key);
    if (!desc) continue;
    try {
      Object.defineProperty(to, key, desc);
    } catch {
      // skip non-configurable exotic keys (caller/arguments)
    }
  }
}

function wrapWithInstanceConfig<T extends (...args: unknown[]) => unknown>(
  fn: T,
  currentConfig: MathJSConfig,
  usesOverlay: () => boolean
): T {
  const wrapped = function (this: unknown, ...args: unknown[]) {
    const construct = new.target;
    const invoke = (): unknown => {
      if (construct) {
        return Reflect.construct(fn, args, construct === wrapped ? fn : construct);
      }
      return fn.apply(this, args);
    };
    if (!usesOverlay()) {
      return invoke();
    }
    return mathFunctions.runWithConfig(currentConfig, invoke);
  };
  copyFunctionSurface(fn, wrapped);
  return wrapped as T;
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
  const defaultsAtCreate: MathJSConfig = {
    ...mathFunctions.config(),
    ...defaultConfig,
  };
  const configBaseline: MathJSConfig = {
    ...defaultsAtCreate,
    ...config,
  };
  const createdWithCustomConfig = instanceConfigUsesOverlay(configBaseline, defaultsAtCreate);
  const currentConfig: MathJSConfig = { ...configBaseline };

  // The overlay decision diffs every config key. Each wrapped call used to repeat that
  // diff (a Set per call, #889); it now recomputes only after config() changes the config.
  let configGeneration = 0;
  let decidedGeneration = -1;
  let overlayNeeded = createdWithCustomConfig;
  /** The only writer of `currentConfig`: every change bumps the generation. */
  const setConfig = (patch: Partial<MathJSConfig>): void => {
    Object.assign(currentConfig, patch);
    configGeneration += 1;
  };
  const usesOverlay = (): boolean => {
    if (decidedGeneration !== configGeneration) {
      decidedGeneration = configGeneration;
      overlayNeeded =
        createdWithCustomConfig || instanceConfigUsesOverlay(currentConfig, configBaseline);
    }
    return overlayNeeded;
  };

  const instance: Record<string, unknown> = {
    // Full @danielsimonjr/mathts-functions namespace — det, integrate, eigs,
    // simplify, and the rest. The compat-specific shims below overlay it.
    ...factories,

    // Per-instance config — does not mutate the functions singleton; wrapped
    // methods run under runWithConfig(currentConfig, …).
    config: (newConfig?: Partial<MathJSConfig>) => {
      if (newConfig) setConfig(newConfig);
      return { ...currentConfig };
    },

    // Type creation
    complex: shims.complex,
    fraction: shims.fraction,
    bignumber: shims.bignumber,
    matrix: shims.matrix,
    sparse: shims.sparse,

    // Arithmetic
    add: bindShim(shims.add),
    subtract: bindShim(shims.subtract),
    multiply: bindShim(shims.multiply),
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
    size: wrapWithInstanceConfig(
      ((...args: unknown[]) => {
        const dims = (mathFunctions.size as (...a: unknown[]) => unknown)(...args);
        if (currentConfig.matrix === 'Matrix' && Array.isArray(dims)) {
          return (mathFunctions.matrix as (data: unknown) => unknown)(dims);
        }
        return dims;
      }) as (...args: unknown[]) => unknown,
      currentConfig,
      usesOverlay
    ),

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

  for (const key of Object.keys(instance)) {
    if (key === 'config' || key === 'chain') continue;
    const value = instance[key];
    if (typeof value !== 'function') continue;
    if (HOT_SCALAR_SHIM_KEYS.has(key)) continue;
    // Lazy + memoized: the config-scoped wrapper is built on first access (a
    // typical program touches a few dozen of the ~1,100 exports), then the
    // accessor is replaced by a plain data property so `math.add === math.add`
    // and later reads cost nothing. Enumerable, so `Object.keys(math)` is
    // unchanged; assigning `math.add = ...` replaces it as before.
    const raw = value as (...args: unknown[]) => unknown;
    let cached: unknown;
    const replaceWith = (v: unknown): void => {
      cached = v;
      // A frozen or sealed instance cannot be redefined; the closure cache then
      // serves every later read (identity still holds).
      if (!Object.isExtensible(instance)) return;
      try {
        Object.defineProperty(instance, key, {
          value: v,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      } catch {
        /* non-configurable: keep serving from the closure */
      }
    };
    Object.defineProperty(instance, key, {
      enumerable: true,
      configurable: true,
      get() {
        if (cached === undefined)
          replaceWith(
            Object.prototype.hasOwnProperty.call(UNARY_NUMBER_FAST_PATH, key)
              ? withNumberFront(
                  raw,
                  UNARY_NUMBER_FAST_PATH[key as keyof typeof UNARY_NUMBER_FAST_PATH],
                  wrapWithInstanceConfig(raw, currentConfig, usesOverlay)
                )
              : wrapWithInstanceConfig(raw, currentConfig, usesOverlay)
          );
        return cached;
      },
      set: replaceWith,
    });
  }

  // GC12 — fluent chain API (math.chain(x).add(3).done()).
  instance.chain = createChain(instance as Record<string, unknown>);

  wireMathjsInstanceApi(instance as Record<string, unknown>, currentConfig);

  return instance as unknown as MathInstance;
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
