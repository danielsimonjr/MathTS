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

import { instanceSymbols } from './instance-symbols.js';
import * as allFactories from './all-factories.js';
import { shims, createCompatPow } from './shims.js';
import { BigNumber as CompatBigNumberCtor } from './bignumber.js';
import { applyG08CompatOverrides } from './g08-inverse-hyperbolic-compat.js';
import { compatFreqz, compatZpk2tf } from './compat-signal-factories.js';
import { MATHJS_PARITY_NAMES } from './parity-names.generated.js';
import { COMPAT_INTERNAL_NAMES, type CompatInternalName } from './internal-names.generated.js';
import { createPrototypeLevels, definePrototypeAccessor } from './instance-layout.js';
import { UNARY_NUMBER_FAST_PATH, type UnaryNumberFastPath } from './unary-fast-path.js';
import { createChain } from './chain.js';
import { compatConstantReaders, type CompatConstantName } from './instance-constants.js';
import type {
  BigNumber as ConfiguredBigNumber,
  Complex,
  UnitInstance,
} from '@danielsimonjr/mathts-core';
import { Fraction, Complex as CompatComplex } from '@danielsimonjr/mathts-core';
import {
  wireMathjsInstanceApi,
  type CompatExpressionLayers,
  type WiredCompatInstance,
} from './instance-api.js';
import { wrapCompatUnitSources } from './mathjs-unit.js';
import { createG07LogicalParity } from './g07-logical-parity.js';
import {
  createCompatBernoulli,
  createCompatCompare,
  createCompatPinv,
} from './mathjs-parity-g06.js';
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import {
  createCompatArg,
  createCompatErfExpression,
  createCompatExpm,
  createCompatGammaBigNumberGuard,
  createCompatMad,
  createCompatMathjsStatistics,
  createForeignScalarConverter,
  isComplexLike as g02IsComplexLike,
  withComplexOrderingGuard,
  withConvertedScalars,
  withCountBoolean,
  withFixedArity,
  withIdentityValidation,
  withRoundDigitsGuard,
  withSingleNumericStringGuard,
  withFractionRejection,
  withInvalidNumericStringGuard,
  withRawSingleValue,
} from './mathjs-parity-g02.js';
import { createCompatSubsetG09, installG09BridgeMatrixSubsetPatch } from './mathjs-parity-g09.js';
import { compatMathjsEigs } from './eigs-mathjs.js';
import {
  bindDefaultInstanceSource,
  Chain,
  chain,
  compile,
  config,
  evaluate,
  parse,
  parser,
  pickRandom,
  random,
  randomInt,
  typed,
  docs,
  compareText as namedCompareText,
  combinations as namedCombinations,
  combinationsWithRep as namedCombinationsWithRep,
  equalText as namedEqualText,
  format as namedFormat,
  lgamma as namedLgamma,
  permutations as namedPermutations,
  print as namedPrint,
  setUnion as namedSetUnion,
  toBest as namedToBest,
  xgcd as namedXgcd,
  string as namedCompatString,
  g18InstanceOverrides,
  zeta as namedZeta,
  symbolicEqual as namedSymbolicEqual,
  range as namedRange,
} from './named-instance-exports.js';
import {
  applyUnitRelationalParity,
  factoryMaxUnits,
  factoryMinUnits,
  factorySignUnits,
  wrapUnitExtrema,
  type UnitRelationalOps,
} from './unit-relational.js';

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

const fullFactoryBundle = Symbol.for('mathts.compat.all');

/** The complete mathjs factory bundle, identifiable across installed package copies. */
const all: typeof allFactories = Object.freeze(
  Object.assign(
    Object.defineProperty(Object.create(null), fullFactoryBundle, { value: true }),
    allFactories
  )
);

type CompatFactoryInput = Record<string, unknown> | readonly unknown[];
type CompatInstanceCreateInput = CompatFactoryInput | Partial<MathJSConfig>;

/**
 * MathTS instance with mathjs-compatible API
 */
interface MathInstanceOverrides {
  /** Fluent chain: `math.chain(x).add(3).done()`. */
  chain: ReturnType<typeof createChain>['chain'];
  /** Chain constructor bound to this instance. */
  Chain: ReturnType<typeof createChain>['Chain'];
  create: (input?: CompatInstanceCreateInput, options?: Partial<MathJSConfig>) => MathInstance;
  Parser: WiredCompatInstance['Parser'];
  on: WiredCompatInstance['on'];
  off: WiredCompatInstance['off'];
  once: WiredCompatInstance['once'];
  /** mathjs expression API: the transform functions and the mathWithTransform scope (#1572). */
  expression: CompatExpressionLayers;

  // Configuration
  config: ((newConfig?: Partial<MathJSConfig>) => MathJSConfig) &
    Omit<ReturnType<typeof mathFunctions.factory_mathjsCompat.configFactory>, never>;

  /** mathjs extension API — register functions visible to `evaluate`. */
  import: (
    functions: unknown,
    options?: { override?: boolean; silent?: boolean; wrap?: boolean }
  ) => void;
  /** mathjs typed-function dispatcher for custom overloads, with the whole `mathTyped` registry surface. */
  typed: WiredCompatInstance['typed'];
  /** Compile an expression or a collection of expressions in this instance. */
  compile: WiredCompatInstance['compile'];
  compileExpr: WiredCompatInstance['compile'];
  /** Evaluate an expression or a collection of expressions in this instance. */
  evaluate: WiredCompatInstance['evaluate'];
  reviver: (key: string, value: unknown) => unknown;
  replacer: (key: string, value: unknown) => unknown;
  subset: (...args: unknown[]) => unknown;
  index: (...args: unknown[]) => unknown;
  unit: typeof namedUnit;
  xgcd: typeof namedXgcd;

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
  compareText: typeof namedCompareText;
  equalText: typeof namedEqualText;
  toBest: typeof namedToBest;
  lgamma: typeof namedLgamma;
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
  zeros: typeof mathFunctions.zeros;
  ones: typeof shims.ones;
  size: typeof mathFunctions.size;

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
 * them all) except the internal names (#1216) with the compat-specific members above taking precedence. No index signature.
 */
export type MathInstance = Omit<
  typeof mathFunctions,
  | keyof MathInstanceOverrides
  | keyof typeof instanceSymbols
  | CompatInternalName
  | CompatConstantName
> &
  Omit<MathInstanceOverrides, CompatConstantName> &
  Omit<typeof instanceSymbols, CompatConstantName> &
  Record<CompatConstantName, number | ConfiguredBigNumber>;

/** The internal names of the functions namespace (#1216). */
const INTERNAL_NAMES: ReadonlySet<string> = new Set(COMPAT_INTERNAL_NAMES);

// G02 (#1550, #1583, #1588): the mathjs-shaped adapters, shared by the instance
// surface and the named exports.
const bridgeDenseProto = Object.getPrototypeOf(mathFunctions.matrix([[1]])) as object;
const bridgeSparseProto = Object.getPrototypeOf(mathFunctions.sparse([[0, 1]])) as object;
const isOwnBridgeMatrix = (x: unknown): boolean => {
  if (Array.isArray(x) || typeof x !== 'object' || x === null) return false;
  const proto = Object.getPrototypeOf(x);
  return proto === bridgeDenseProto || proto === bridgeSparseProto;
};
const convertForeignScalar = createForeignScalarConverter({
  FractionClass: Fraction,
  BigNumberClass: CompatBigNumberCtor,
  ComplexClass: CompatComplex,
  denseFrom: mathFunctions.matrix as (nested: unknown) => unknown,
  sparseFrom: mathFunctions.sparse as (nested: unknown) => unknown,
  isOwnMatrix: isOwnBridgeMatrix,
});
const withBigNumberPrecision = (precision: number, build: () => unknown): unknown =>
  mathFunctions.runWithConfig({ precision }, build);
const compatArgDefault = createCompatArg(
  mathFunctions.arg as (...args: unknown[]) => unknown,
  CompatBigNumberCtor,
  () => defaultConfig.precision ?? 64,
  withBigNumberPrecision
);
const compatExpm = createCompatExpm(
  mathFunctions.expm as (...args: unknown[]) => unknown,
  mathFunctions.matrix as (...args: unknown[]) => unknown
);
const compatMad = createCompatMad({
  subtract: mathFunctions.subtract as (...args: unknown[]) => unknown,
  abs: mathFunctions.abs as (...args: unknown[]) => unknown,
  add: mathFunctions.add as (...args: unknown[]) => unknown,
  divide: mathFunctions.divide as (...args: unknown[]) => unknown,
  compare: mathFunctions.compare as (...args: unknown[]) => unknown,
  unaryPlus: mathFunctions.factory_unaryPlus as (...args: unknown[]) => unknown,
  convert: convertForeignScalar,
});

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
 * Copies every enumerable name of `factories`, own and inherited. A compat instance
 * passed as `factories` keeps most names on prototype levels (#1200), which a spread
 * of own keys misses.
 *
 * @param factories - The namespace to copy.
 * @returns A plain object with every enumerable name of `factories`.
 */
function surfaceOf(factories: CompatFactoryInput): Record<string, unknown> {
  const surface: Record<string, unknown> = {};
  for (const key in factories) surface[key] = Reflect.get(factories, key);
  return surface;
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
 * math.matrix([[1,2],[3,4]]); // dense Matrix
 * math.det([[1,2],[3,4]]);    // -2  (full functions surface)
 * ```
 */
export function create(
  factories: CompatFactoryInput = all,
  config: Partial<MathJSConfig> = {}
): MathInstance {
  const canonical =
    factories === all ||
    Object.getOwnPropertyDescriptor(factories, fullFactoryBundle)?.value === true;
  if (!canonical) {
    const selected = mathFunctions.factory_mathjsCompat.tryCreateFactoryBundle(factories, config);
    if (selected !== undefined) return selected as MathInstance;
  }

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

  const g02StatisticsDeps = {
    add: mathFunctions.add as (...args: unknown[]) => unknown,
    subtract: mathFunctions.subtract as (...args: unknown[]) => unknown,
    multiply: mathFunctions.multiply as (...args: unknown[]) => unknown,
    divide: mathFunctions.divide as (...args: unknown[]) => unknown,
    sqrt: mathFunctions.sqrt as (...args: unknown[]) => unknown,
    matrix: mathFunctions.matrix as (data: unknown, storage?: string) => unknown,
  };
  const compatArg = createCompatArg(
    mathFunctions.arg as (...args: unknown[]) => unknown,
    CompatBigNumberCtor,
    () => currentConfig.precision ?? 64,
    withBigNumberPrecision
  );
  const compatStd = createCompatMathjsStatistics(
    'std',
    shims.std as (...args: unknown[]) => unknown,
    g02StatisticsDeps
  );
  const compatVariance = createCompatMathjsStatistics(
    'variance',
    shims.variance as (...args: unknown[]) => unknown,
    g02StatisticsDeps
  );
  const compatErf = createCompatErfExpression(mathFunctions.erf as (...args: unknown[]) => unknown);
  const compatGamma = createCompatGammaBigNumberGuard(
    mathFunctions.gamma as (...args: unknown[]) => unknown,
    convertForeignScalar
  );
  installG09BridgeMatrixSubsetPatch(mathFunctions.matrix([]));
  const compatSubset = createCompatSubsetG09(
    mathFunctions.subset as (...args: never[]) => unknown,
    {
      add: mathFunctions.add as (...args: unknown[]) => unknown,
      zeros: mathFunctions.zeros as (dims: number | number[]) => unknown,
    }
  );

  // G06 (#1554): pinv and bernoulli keep BigNumber / Fraction / Complex inputs;
  // compare rejects a Complex operand the mathjs way. All compat-only adapters.
  const compatPinv = createCompatPinv(mathFunctions.pinv as (...args: unknown[]) => unknown, {
    convert: convertForeignScalar,
    divide: shims.divide as (...args: unknown[]) => unknown,
    equal: mathFunctions.equal as (...args: unknown[]) => unknown,
    inv: mathFunctions.inv as (...args: unknown[]) => unknown,
    deepEqual: mathFunctions.deepEqual as (...args: unknown[]) => unknown,
    dotDivide: mathFunctions.dotDivide as (...args: unknown[]) => unknown,
    dot: mathFunctions.dot as (...args: unknown[]) => unknown,
    ctranspose: mathFunctions.ctranspose as (...args: unknown[]) => unknown,
    multiply: shims.multiply as (...args: unknown[]) => unknown,
    add: shims.add as (...args: unknown[]) => unknown,
    matrix: shims.matrix as (data: unknown, storage?: 'dense' | 'sparse') => unknown,
    complex: shims.complex as (re: number, im: number) => unknown,
    isMatrix: shims.isMatrix as (x: unknown) => boolean,
  });
  const compatBernoulli = createCompatBernoulli(
    mathFunctions.bernoulli as (...args: unknown[]) => unknown,
    {
      convert: convertForeignScalar,
      BigNumberClass: CompatBigNumberCtor,
      FractionClass: Fraction,
      precision: () => currentConfig.precision ?? 64,
    }
  );
  const compatUnaryPlus = withInvalidNumericStringGuard(
    withConvertedScalars(
      convertForeignScalar,
      mathFunctions.factory_unaryPlus as (...args: unknown[]) => unknown
    )
  );

  // The overlay decision diffs every config key. Each wrapped call used to repeat that
  // diff (a Set per call, #889); it now recomputes only after config() changes the config.
  let configGeneration = 0;
  let decidedGeneration = -1;
  let overlayNeeded = createdWithCustomConfig;
  const fullBundle =
    canonical ||
    Object.entries(all).every(([name, factory]) => Reflect.get(factories, name) === factory);
  // Always give a full-bundle `create(all)` its own Unit class. Patching
  // `typeConverters` on `instanceSymbols.Unit` would mutate the shared native
  // constructor that functions/core use (#1551).
  const rawLocalUnits = fullBundle
    ? mathFunctions.factory_mathjsCompat.createCompatUnitSources(currentConfig)
    : undefined;
  const localUnits = rawLocalUnits ? wrapCompatUnitSources(rawLocalUnits) : undefined;
  const instanceConfig = mathFunctions.factory_mathjsCompat.configFactory(
    currentConfig as RuntimeConfig,
    (event, current, previous, changes) => {
      configGeneration += 1;
      localUnits?.update(current, previous);
      if (current.number !== previous.number || current.precision !== previous.precision) {
        for (const [key, read] of Object.entries(constantReaders)) {
          if (!Object.isFrozen(instance)) instance[key] = read();
        }
      }
      const emit = instance.emit as ((...args: unknown[]) => void) | undefined;
      emit?.(event, current, previous, changes);
    }
  );
  const usesOverlay = (): boolean => {
    if (decidedGeneration !== configGeneration) {
      decidedGeneration = configGeneration;
      overlayNeeded =
        createdWithCustomConfig || instanceConfigUsesOverlay(currentConfig, configBaseline);
    }
    return overlayNeeded;
  };

  function createSibling(
    input?: CompatInstanceCreateInput,
    options?: Partial<MathJSConfig>
  ): MathInstance {
    if (input === undefined) return create(options === undefined ? factories : all, options);
    if (
      options === undefined &&
      !Array.isArray(input) &&
      Object.keys(input).every(
        (name) =>
          Object.hasOwn(configBaseline, name) && typeof Reflect.get(input, name) !== 'function'
      )
    ) {
      return create(factories, input as Partial<MathJSConfig>);
    }
    return create(input as CompatFactoryInput, options);
  }

  // Mixed namespaces may extend a spread of all with ordinary functions or values.
  const originalSurface: Record<string, unknown> = fullBundle
    ? {
        ...mathFunctions,
        ...instanceSymbols,
        ...Object.fromEntries(
          canonical ? [] : Object.entries(factories).filter(([key]) => !Object.hasOwn(all, key))
        ),
      }
    : surfaceOf(factories);
  const unitRelationalBase: UnitRelationalOps = {
    equal: mathFunctions.equal as UnitRelationalOps['equal'],
    unequal: mathFunctions.unequal as UnitRelationalOps['unequal'],
    equalScalar: mathFunctions.equalScalar as UnitRelationalOps['equalScalar'],
    deepEqual: mathFunctions.deepEqual as UnitRelationalOps['deepEqual'],
    // #1550: the activated compare factory keeps a Fraction/BigNumber result.
    compare: mathFunctions.factory_compare as UnitRelationalOps['compare'],
    larger: mathFunctions.larger as UnitRelationalOps['larger'],
    smaller: mathFunctions.smaller as UnitRelationalOps['smaller'],
    largerEq: mathFunctions.largerEq as UnitRelationalOps['largerEq'],
    smallerEq: mathFunctions.smallerEq as UnitRelationalOps['smallerEq'],
  };
  const unitRelational = applyUnitRelationalParity(unitRelationalBase);

  const flat: Record<string, unknown> = {
    // Full @danielsimonjr/mathts-functions namespace — det, integrate, eigs,
    // simplify, and the rest. The compat-specific shims below overlay it.
    ...originalSurface,
    create: createSibling,

    // G04: mathjs unit equality / ordering through activated factories (#1552).
    equal: unitRelational.equal,
    unequal: unitRelational.unequal,
    equalScalar: unitRelational.equalScalar,
    deepEqual: unitRelational.deepEqual,
    compare: createCompatCompare(unitRelational.compare, convertForeignScalar),
    larger: unitRelational.larger,
    smaller: unitRelational.smaller,
    largerEq: unitRelational.largerEq,
    smallerEq: unitRelational.smallerEq,

    // Per-instance config — does not mutate the functions singleton; wrapped
    // methods run under runWithConfig(currentConfig, …).
    config: instanceConfig,

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
    dotMultiply: bindShim(shims.dotMultiply),
    pow: bindShim(createCompatPow(() => Boolean(currentConfig.predictable))),
    zpk2tf: bindShim(compatZpk2tf),
    freqz: bindShim(compatFreqz),
    isPositive: mathFunctions.isPositive,
    isNegative: mathFunctions.isNegative,
    isInteger: mathFunctions.isInteger,
    fix: withConvertedScalars(convertForeignScalar, mathFunctions.factory_fix),
    sqrt: withFractionRejection(shims.sqrt),
    abs: shims.abs,
    // #1587: a Fraction argument throws the mathjs conversion error.
    exp: withFractionRejection(shims.exp),
    log: withFractionRejection(shims.log),

    // Trigonometry — #1587: a Fraction argument throws the mathjs conversion error.
    sin: withFractionRejection(shims.sin),
    cos: withFractionRejection(shims.cos),
    tan: withFractionRejection(shims.tan),
    asin: withFractionRejection(shims.asin),
    acos: withFractionRejection(shims.acos),
    atan: withFractionRejection(shims.atan),
    atan2: withFractionRejection(shims.atan2),

    // Statistics
    sum: withSingleNumericStringGuard(withRawSingleValue(shims.sum)),
    mean: shims.mean,
    std: compatStd,
    variance: compatVariance,
    min: withComplexOrderingGuard(
      'min',
      withRawSingleValue(
        wrapUnitExtrema(shims.min as (...args: unknown[]) => unknown, factoryMinUnits),
        g02IsComplexLike
      )
    ),
    max: withComplexOrderingGuard(
      'max',
      withRawSingleValue(
        wrapUnitExtrema(shims.max as (...args: unknown[]) => unknown, factoryMaxUnits),
        g02IsComplexLike
      )
    ),
    sign: wrapUnitExtrema(mathFunctions.sign as (...args: unknown[]) => unknown, factorySignUnits),

    // Number theory
    gcd: shims.gcd,
    lcm: shims.lcm,

    // Rounding — #1550: mathjs-shaped factories; foreign oracle scalars convert first.
    round: withRoundDigitsGuard(withConvertedScalars(convertForeignScalar, shims.round)),
    floor: withConvertedScalars(convertForeignScalar, shims.floor),
    ceil: withConvertedScalars(convertForeignScalar, shims.ceil),

    // Complex-specific
    conj: shims.conj,
    re: shims.re,
    im: shims.im,
    // #1550: the native `arg` keeps a BigNumber operand a BigNumber.
    arg: compatArg,

    // Matrix-specific
    transpose: shims.transpose,
    det: shims.det,
    identity: withFractionRejection(
      withConvertedScalars(convertForeignScalar, withIdentityValidation(shims.identity))
    ),
    zeros: withFractionRejection(withConvertedScalars(convertForeignScalar, mathFunctions.zeros)),
    ones: withFractionRejection(withConvertedScalars(convertForeignScalar, shims.ones)),
    size: mathFunctions.size,

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

    // #1561 — mathjs 15.3.0 eigs (precision, vector scale, value order); native solver stays in functions.
    eigs: compatMathjsEigs,

    // Placeholder; rebound below once `instance` exists so chain methods can
    // resolve against the full surfaced namespace.
    chain: (() => {
      throw new Error('chain not initialized');
    }) as MathInstance['chain'],
  };

  // Layout (#1200): the mathjs-parity names are own keys of the instance; every other
  // name is on a prototype level below it (see instance-layout.ts). Both stay in V8
  // fast mode, so `math.x` is not a dictionary lookup.
  const parityNames = new Set(MATHJS_PARITY_NAMES);
  // Internal names of the functions namespace (#1216) are not surfaced: not own, not
  // inherited. A value that the caller supplies under such a name stays (#1250).
  const functionsNamespace = mathFunctions as unknown as Record<string, unknown>;
  const g08Overrides = applyG08CompatOverrides({
    factory_asinh: mathFunctions.factory_asinh,
    factory_acosh: mathFunctions.factory_acosh,
    factory_atanh: mathFunctions.factory_atanh,
    acoth: mathFunctions.acoth,
    acsch: mathFunctions.acsch,
    asech: mathFunctions.asech,
    factory_acsc: mathFunctions.factory_acsc,
    factory_asec: mathFunctions.factory_asec,
  });
  const g07Logical = createG07LogicalParity();
  const { rangeEvaluate: g18RangeEvaluate, ...g18Surface } = g18InstanceOverrides(
    () => currentConfig
  );
  const compatDefaultOverrides = {
    // #1587: a Fraction argument throws the mathjs conversion error, on top of
    // the G08 complex.js adapters (inverse hyperbolics) and the factories.
    acosh: withFractionRejection(g08Overrides.acosh),
    acot: withFractionRejection(mathFunctions.factory_acot),
    acoth: withFractionRejection(g08Overrides.acoth),
    acsc: withFractionRejection(g08Overrides.acsc),
    acsch: withFractionRejection(g08Overrides.acsch),
    asec: withFractionRejection(g08Overrides.asec),
    asech: withFractionRejection(g08Overrides.asech),
    asinh: withFractionRejection(g08Overrides.asinh),
    atanh: withFractionRejection(g08Overrides.atanh),
    cbrt: withFractionRejection(mathFunctions.factory_cbrt),
    cosh: withFractionRejection(mathFunctions.factory_cosh),
    cot: withFractionRejection(mathFunctions.factory_cot),
    csc: withFractionRejection(mathFunctions.factory_csc),
    bernoulli: compatBernoulli,
    cube: mathFunctions.factory_cube,
    expm1: withFractionRejection(mathFunctions.factory_expm1),
    erf: compatErf,
    gamma: withFractionRejection(compatGamma),
    sec: withFractionRejection(mathFunctions.factory_sec),
    sinh: withFractionRejection(mathFunctions.factory_sinh),
    square: mathFunctions.factory_square,
    tanh: withFractionRejection(mathFunctions.factory_tanh),
    // #1587: the remaining trigonometry surface rejects a Fraction argument as
    // mathjs does; acoth/asech/acsch keep their G08 adapters above.
    csch: withFractionRejection(mathFunctions.csch),
    coth: withFractionRejection(mathFunctions.coth),
    sech: withFractionRejection(mathFunctions.sech),
    log10: withFractionRejection(mathFunctions.log10),
    log2: withFractionRejection(mathFunctions.log2),
    // #1550: the mathjs-shaped factories keep a Unit operand and broadcast nthRoot.
    unaryMinus: mathFunctions.factory_unaryMinus,
    unaryPlus: compatUnaryPlus,
    nthRoot: mathFunctions.factory_nthRoot,
    // #1587: count of a boolean is the string length; size/inv take one argument.
    count: withCountBoolean(mathFunctions.count),
    size: withFixedArity('size', 1, mathFunctions.size),
    inv: withFixedArity('inv', 1, mathFunctions.inv),
    // #1583 / #1588: the mathjs-shaped mad and the Matrix-returning expm.
    mad: compatMad,
    expm: compatExpm,
    pinv: compatPinv,
    bignumber: shims.bignumber,
    format: namedFormat,
    print: namedPrint,
    string: namedCompatString,
    setUnion: namedSetUnion,
    compareText: namedCompareText,
    equalText: namedEqualText,
    toBest: namedToBest,
    unit: localUnits?.unit ?? namedUnit,
    createUnit: localUnits?.createUnit ?? namedCreateUnit,
    combinations: namedCombinations,
    combinationsWithRep: namedCombinationsWithRep,
    xgcd: namedXgcd,
    mod: mathFunctions.factory_mod,
    permutations: namedPermutations,
    lgamma: namedLgamma,
    ...g18Surface,
    nullish: g07Logical.nullish,
    not: g07Logical.not,
    and: g07Logical.and,
    or: g07Logical.or,
    xor: g07Logical.xor,
    diag: mathFunctions.diag,
    rotationMatrix: mathFunctions.rotationMatrix,
    subset: compatSubset,
  };
  const overriddenNames = Object.keys(compatDefaultOverrides).filter(
    (name) => originalSurface[name] === functionsNamespace[name]
  ) as (keyof typeof compatDefaultOverrides)[];
  for (const name of overriddenNames) flat[name] = compatDefaultOverrides[name];
  if (localUnits) flat.Unit = localUnits.Unit;
  const flatKeys = Object.keys(flat).filter(
    (key) => !(INTERNAL_NAMES.has(key) && Object.is(flat[key], functionsNamespace[key]))
  );
  const inheritedKeys = flatKeys.filter((key) => !parityNames.has(key));
  const { levels, perLevel } = createPrototypeLevels(inheritedKeys.length);
  const instance = Object.create(levels[0] ?? Object.prototype) as Record<string, unknown>;
  const constantReaders = compatConstantReaders(
    flat,
    currentConfig,
    (localUnits?.Unit ?? instanceSymbols.Unit) as typeof instanceSymbols.Unit,
    (name) => originalSurface[name] === functionsNamespace[name]
  );
  const expressionConstants: Record<string, () => unknown> = {};
  for (const name of overriddenNames) {
    if (name === 'range') {
      expressionConstants.range = () => g18RangeEvaluate;
      continue;
    }
    expressionConstants[name] = () => instance[name];
  }
  if (originalSurface.add === mathFunctions.add) expressionConstants.add = () => instance.add;
  if (originalSurface.multiply === mathFunctions.multiply) {
    expressionConstants.multiply = () => instance.multiply;
  }
  if (originalSurface.fraction === mathFunctions.fraction) {
    expressionConstants.fraction = () => instance.fraction;
  }
  if (originalSurface.pow === mathFunctions.pow) expressionConstants.pow = () => instance.pow;
  for (const name of [
    'equal',
    'unequal',
    'equalScalar',
    'deepEqual',
    'compare',
    'larger',
    'smaller',
    'largerEq',
    'smallerEq',
  ] as const) {
    expressionConstants[name] = () => instance[name];
  }
  for (const name of [
    'arg',
    'conj',
    'im',
    're',
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',
    'sqrt',
    'exp',
    'log',
  ] as const) {
    if (originalSurface[name] === mathFunctions[name])
      expressionConstants[name] = () => instance[name];
  }
  if (Object.hasOwn(flat, 'version')) expressionConstants.version = () => instance.version;
  // `config` inside an expression is the instance's config function (#1562):
  // `evaluate('config()')` reads the fields and
  // `evaluate('config({number: "Fraction"})')` updates that instance.
  expressionConstants.config = () => instance.config;
  // #1587: the expression scope's erf rejects a BigNumber argument, as the
  // mathjs scope does; the direct instance call keeps its BigNumber extension.
  expressionConstants.erf = () =>
    createCompatErfExpression(mathFunctions.erf as (...args: unknown[]) => unknown);

  /** The config-scoped wrapper of a surfaced function, built on first read. */
  const buildWrapper = (key: string, raw: (...args: unknown[]) => unknown): unknown =>
    Object.prototype.hasOwnProperty.call(UNARY_NUMBER_FAST_PATH, key)
      ? withNumberFront(
          raw,
          UNARY_NUMBER_FAST_PATH[key as keyof typeof UNARY_NUMBER_FAST_PATH],
          wrapWithInstanceConfig(raw, currentConfig, usesOverlay)
        )
      : wrapWithInstanceConfig(raw, currentConfig, usesOverlay);
  const isLazy = (key: string, value: unknown): value is (...args: unknown[]) => unknown =>
    typeof value === 'function' &&
    key !== 'config' &&
    key !== 'create' &&
    key !== 'chain' &&
    !HOT_SCALAR_SHIM_KEYS.has(key);

  inheritedKeys.forEach((key, index) => {
    const value = flat[key];
    const level = levels[Math.floor(index / perLevel)] as Record<string, unknown>;
    definePrototypeAccessor(
      level,
      key,
      isLazy(key, value) ? () => buildWrapper(key, value) : () => value,
      instance
    );
  });

  for (const key of flatKeys) {
    if (!parityNames.has(key)) continue;
    const readConstant = Object.hasOwn(constantReaders, key) ? constantReaders[key] : undefined;
    if (readConstant) {
      Object.defineProperty(instance, key, {
        value: readConstant(),
        writable: true,
        enumerable: true,
        configurable: true,
      });
      if (key !== 'Infinity' && key !== 'NaN') expressionConstants[key] = () => instance[key];
      continue;
    }
    const value = flat[key];
    if (!isLazy(key, value)) {
      Object.defineProperty(instance, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      continue;
    }
    // Lazy + memoized own key: the config-scoped wrapper is built on first access,
    // then the accessor is replaced by a plain data property so `math.add === math.add`
    // and later reads cost nothing. Assigning `math.add = ...` replaces it as before.
    const raw = value;
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
        if (cached === undefined) replaceWith(buildWrapper(key, raw));
        return cached;
      },
      set(v: unknown) {
        // A frozen instance is read-only, as for a data property.
        if (Object.isFrozen(instance)) {
          throw new TypeError(`Cannot assign to read only property '${key}' of object`);
        }
        replaceWith(v);
      },
    });
  }

  // The mathjs instance API below assigns its names. The parity names among them
  // (import, evaluate, compile, ...) become own keys; compileExpr is not a mathjs name,
  // so its assignment goes to the setter of its prototype level.

  // GC12 — fluent chain API (math.chain(x).add(3).done()).
  const chainApi = createChain(instance);
  instance.chain = chainApi.chain;
  if (flat.Chain === functionsNamespace.Chain) instance.Chain = chainApi.Chain;

  // Only the parser of the functions namespace is bound to the instance: a parser that
  // the caller supplies stays as given (#1250).
  wireMathjsInstanceApi(
    instance as Record<string, unknown>,
    currentConfig,
    flat.parser === functionsNamespace.parser,
    flat.parse === functionsNamespace.parse && typeof flat.parse === 'function',
    expressionConstants,
    new Set(
      ['random', 'randomInt', 'pickRandom'].filter(
        (name) => originalSurface[name] === functionsNamespace[name]
      )
    )
  );
  // mathjs shares one `DimensionError` constructor on the module and on each instance (#G12 F4).
  instance.DimensionError = instanceSymbols.DimensionError;

  return instance as unknown as MathInstance;
}

/**
 * All available factory functions
 *
 * Use with `create(all)` to get a fully-featured math instance.
 */
export { all };

// The default-instance wrappers of named-instance-exports.ts build their lazy
// instance through `create` and `all`; bind them here so that module keeps no
// import of this one (runtime or type-only). Architecture docs pin 2 runtime
// cycles; the bind types live in compat-types.ts.
bindDefaultInstanceSource(create, all);

// =============================================================================
// Re-exports for direct use
// =============================================================================
// The definitions live in named-instance-exports.ts: this file is where every
// parallel PR used to add a wrapper or a re-export, so it stayed the conflict
// hotspot. Add a new wrapper group as its own file and re-export it here, or
// extend the matching group file.

export { Chain, chain, compile, config, evaluate, parse, parser };

export { pickRandom, random, randomInt };

export {
  namedFormat as format,
  namedPrint as print,
  namedCompatString as string,
  namedSetUnion as setUnion,
  namedCompareText as compareText,
  namedEqualText as equalText,
  namedToBest as toBest,
  namedPermutations as permutations,
  namedCombinations as combinations,
  namedCombinationsWithRep as combinationsWithRep,
  namedXgcd as xgcd,
  namedLgamma as lgamma,
  namedRange as range,
  namedSymbolicEqual as symbolicEqual,
  namedZeta as zeta,
};

export {
  equal,
  unequal,
  equalScalar,
  deepEqual,
  compare,
  larger,
  smaller,
  largerEq,
  smallerEq,
} from './named-instance-exports.js';

export { docs };

export { typed };

export { Parser } from './named-instance-exports.js';

export { compatReplacer as replacer, compatReviver as reviver } from './serialization.js';
export { compatMathjsEigs as eigs };

export * from './named-symbols.js';
export * from './native-factory-exports.js';
export * from './constant-factory-exports.js';
export * from './named-physical-constants.generated.js';

// Mathematical functions shared with the functions package: one name per line, in
// sorted order, in function-reexports.ts so parallel additions don't conflict.
export * from './function-reexports.js';

// G02 (#1550, #1583, #1588): the named mathjs-shaped adapters shadow the native
// re-exports above (an explicit export wins over a star export).
export { compatExpm as expm, compatMad as mad, compatArgDefault as arg };

// These four names are also star-exported by ./shims.js (the G03 sign-predicate
// wrappers). The explicit re-export keeps the functions implementation winning,
// exactly as the previous explicit block in this file did.
export { fix, isInteger, isNegative, isPositive } from './function-reexports.js';

type UnitMagnitude = number | ConfiguredBigNumber | Fraction;

/** Construct or clone a unit using the MathJS scalar signatures. */
const namedCreateUnit: typeof mathFunctions.createUnit =
  mathFunctions.factory_mathjsCompat.createUnit;
const namedUnit = mathFunctions.factory_mathjsCompat.unit as {
  (value: string | UnitMagnitude | UnitInstance): UnitInstance;
  (value: UnitMagnitude | Complex, unit: string | UnitInstance): UnitInstance;
} & typeof mathFunctions.unit;
export { namedUnit as unit, namedCreateUnit as createUnit };

// Re-export all shims for direct import
export * from './shims.js';

export { BigNumber } from './bignumber.js';

// Re-export core types
export {
  Complex,
  Fraction,
  isBigNumber,
  isComplex,
  isFraction,
  isNumber,
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
