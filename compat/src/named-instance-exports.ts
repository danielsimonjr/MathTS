/**
 * The compat default-instance wrappers and the named parity wrappers, with
 * their re-export surface.
 *
 * These definitions lived inside `src/index.ts`. That file is where every
 * parallel PR used to add a wrapper, a default-instance binding or a function
 * re-export, so concurrent PRs kept conflicting on its lines. The definitions
 * live here now; `src/index.ts` only re-exports them. Add a new wrapper group
 * as its own file under `src/` and re-export it from `src/index.ts`.
 *
 * `create` and `all` live in `src/index.js`; index binds them at module scope
 * with `bindDefaultInstanceSource`, so this module holds no import of
 * `./index.js` (runtime or type-only). Bind types live in `compat-types.ts`.
 * `getDefaultInstance` runs lazily, long after the bind.
 *
 * @packageDocumentation
 */
import type { mathTyped } from '@danielsimonjr/mathts-core';
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import mathjsDocs1530 from './mathjs-docs-15.3.0.generated.json' with { type: 'json' };
import {
  parser as functionsParser,
  type PhysicsEvaluateOptions,
} from '@danielsimonjr/mathts-functions';
import { createChain } from './chain-create.js';
import type { BoundInstanceConfig, CompatCreate, CompatFactoryInput } from './compat-types.js';
import {
  createCompatBaseFormat,
  createCompatFormat,
  createCompatPrint,
  createCompatString,
} from './fraction-format-parity.js';
import { instanceSymbols } from './instance-symbols.js';
import {
  createMathjsRange,
  createMathjsRangeEvaluate,
  createMathjsSymbolicEqual,
  createMathjsZeta,
} from './mathjs-parity-1585.js';
import { applyUnitRelationalParity, type UnitRelationalOps } from './unit-relational.js';

let createInstance:
  | ((factories: CompatFactoryInput, config: BoundInstanceConfig) => Record<string, unknown>)
  | undefined;
let allBundle: CompatFactoryInput | undefined;

/**
 * Hand `create` and `all` over from `src/index.ts`, which calls this at module
 * scope right after their definitions. Called before any wrapper can run.
 */
export function bindDefaultInstanceSource(create: CompatCreate, all: CompatFactoryInput): void {
  createInstance = create as typeof createInstance;
  allBundle = all;
}

const moduleDefaults = {
  relTol: 1e-12,
  absTol: 1e-15,
  matrix: 'Matrix',
  number: 'number',
  numberFallback: 'number',
  precision: 64,
  predictable: false,
  randomSeed: null,
  legacySubset: false,
} as const satisfies BoundInstanceConfig;

export { moduleDefaults };

let defaultInstance: Record<string, unknown> | undefined;

function getDefaultInstance(): Record<string, unknown> {
  if (!createInstance || !allBundle) {
    throw new Error('compat default instance source is not bound by src/index.ts');
  }
  return (defaultInstance ??= createInstance(allBundle, moduleDefaults));
}

/** Evaluate an expression or a collection in the default compatibility instance. */
const defaultEvaluate = ((...args: unknown[]) =>
  (getDefaultInstance().evaluate as (...args: unknown[]) => unknown)(
    ...args
  )) as typeof mathFunctions.evaluate;

/** Compile an expression or a collection in the default compatibility instance. */
const defaultCompile = ((...args: unknown[]) =>
  (getDefaultInstance().compile as (...args: unknown[]) => unknown)(
    ...args
  )) as typeof mathFunctions.compile;

/** Parse an expression into a mathjs-compatible syntax tree. */
const defaultParse = /* #__PURE__ */ new Proxy(mathFunctions.parse, {
  get: (target, key, receiver) =>
    typeof key === 'string' && key.startsWith('is')
      ? Reflect.get(getDefaultInstance().parse as object, key)
      : Reflect.get(target, key, receiver),
  apply: (_target, receiver, args) =>
    Reflect.apply(getDefaultInstance().parse as (...args: unknown[]) => unknown, receiver, args),
}) as typeof mathFunctions.parse;

type CompatParser = ReturnType<typeof functionsParser>;

/** Stateful expression parser for the default compatibility instance. */
export const Parser = function Parser(options?: PhysicsEvaluateOptions): CompatParser {
  // mathjs 15.3.0 throws this SyntaxError on a new-less call (#1774).
  if (new.target === undefined) {
    throw new SyntaxError('Constructor must be called with the new operator');
  }
  return Reflect.construct(getDefaultInstance().Parser as typeof Parser, [options], new.target);
} as unknown as { new (options?: PhysicsEvaluateOptions): CompatParser };

/** Create a compatibility parser with its own retained scope. */
const defaultParser = (options?: PhysicsEvaluateOptions) => new Parser(options);

const defaultChainApi = /* #__PURE__ */ createChain(
  /* #__PURE__ */ new Proxy<Record<string, unknown>>(
    {},
    {
      get(_target, property) {
        return Reflect.get(getDefaultInstance(), property);
      },
    }
  )
);

/** Start a fluent chain using the default compatibility instance. */
const defaultChain = /* #__PURE__ */ (() => defaultChainApi.chain)();

/** Chain constructor that uses the default compatibility instance. */
const defaultChainConstructor = /* #__PURE__ */ (() => defaultChainApi.Chain)();

export {
  defaultChainConstructor as Chain,
  defaultChain as chain,
  defaultCompile as compile,
  defaultEvaluate as evaluate,
  defaultParse as parse,
  defaultParser as parser,
};

/** Read the configuration for MathJS-compatible named imports. */
const defaultConfigReader = /* #__PURE__ */ Object.assign(
  (settings?: Partial<BoundInstanceConfig>) => {
    if (settings !== undefined) {
      throw new Error('The global config is readonly. Create an instance to change its settings.');
    }
    return { ...moduleDefaults };
  },
  moduleDefaults,
  {
    MATRIX_OPTIONS: ['Matrix', 'Array'],
    NUMBER_OPTIONS: ['number', 'BigNumber', 'bigint', 'Fraction'],
  }
);

const namedRandomSources =
  /* #__PURE__ */ mathFunctions.factory_mathjsCompat.createCompatRandomSources(
    moduleDefaults,
    undefined
  );
type NamedRandomSources = ReturnType<
  typeof mathFunctions.factory_mathjsCompat.createCompatRandomSources
>;

const defaultRandom: ReturnType<NamedRandomSources['random']> =
  /* #__PURE__ */ namedRandomSources.random();
const defaultRandomInt: ReturnType<NamedRandomSources['randomInt']> =
  /* #__PURE__ */ namedRandomSources.randomInt();
const defaultPickRandom: ReturnType<NamedRandomSources['pickRandom']> =
  /* #__PURE__ */ namedRandomSources.pickRandom();

export {
  defaultConfigReader as config,
  defaultPickRandom as pickRandom,
  defaultRandom as random,
  defaultRandomInt as randomInt,
};

/** Union of two multisets in MathJS result order. */
const namedSetUnion: typeof mathFunctions.setUnion = mathFunctions.factory_mathjsCompat.setUnion;
const namedString = mathFunctions.factory_mathjsCompat.string as typeof mathFunctions.string;
const namedCompatString = /* #__PURE__ */ createCompatString(namedString);
const namedBin = /* #__PURE__ */ createCompatBaseFormat(
  mathFunctions.bin as (...args: unknown[]) => string
) as typeof mathFunctions.bin;
const namedOct = /* #__PURE__ */ createCompatBaseFormat(
  mathFunctions.oct as (...args: unknown[]) => string
) as typeof mathFunctions.oct;
const namedHex = /* #__PURE__ */ createCompatBaseFormat(
  mathFunctions.hex as (...args: unknown[]) => string
) as typeof mathFunctions.hex;
const namedFormat = /* #__PURE__ */ createCompatFormat(mathFunctions.format);
const namedPrint = /* #__PURE__ */ createCompatPrint(
  mathFunctions.print as (template: string, values: unknown, options?: unknown) => string,
  mathFunctions.format
);
const namedCompareText = mathFunctions.factory_mathjsCompat.compareText as {
  (left: string, right: string): number;
  (left: unknown, right: unknown): unknown;
};
const namedEqualText = mathFunctions.factory_mathjsCompat.equalText as {
  (left: string, right: string): boolean;
  (left: unknown, right: unknown): unknown;
};
const namedCombinationsWithRep = mathFunctions.factory_mathjsCompat
  .combinationsWithRep as typeof mathFunctions.combinationsWithRep;
const namedCombinations = mathFunctions.factory_mathjsCompat
  .combinations as typeof mathFunctions.combinations;
const namedXgcd = mathFunctions.factory_mathjsCompat.xgcd as unknown as (
  a: unknown,
  b: unknown
) => unknown[] | mathFunctions.BridgeMatrix;
const namedPermutations = mathFunctions.factory_mathjsCompat
  .permutations as typeof mathFunctions.permutations;
const namedLgamma = mathFunctions.factory_mathjsCompat.lgamma as (
  ...args: unknown[]
) => ReturnType<typeof mathFunctions.lgamma>;
const namedToBest = mathFunctions.factory_mathjsCompat.toBest as (
  ...args: unknown[]
) => ReturnType<typeof mathFunctions.toBest>;

const g18Typed = mathFunctions.factory_mathjsCompat.createCompatTyped();
const parityIsBounded = Reflect.get(mathFunctions, 'isBounded') as (x: unknown) => boolean;
const parityIsNegative = Reflect.get(mathFunctions, 'isNegative') as (x: unknown) => boolean;

type G18ParityConfig = { relTol?: number; number?: string };

function mathjsZetaDeps(config: () => G18ParityConfig) {
  return {
    typed: g18Typed,
    config,
    multiply: mathFunctions.multiply,
    pow: mathFunctions.pow,
    divide: mathFunctions.divide,
    factorial: mathFunctions.factorial,
    equal: mathFunctions.equal,
    smallerEq: mathFunctions.smallerEq,
    isBounded: parityIsBounded,
    isNegative: parityIsNegative,
    gamma: mathFunctions.gamma,
    sin: mathFunctions.sin,
    subtract: mathFunctions.subtract,
    add: mathFunctions.add,
    Complex: instanceSymbols.Complex,
    BigNumber: instanceSymbols.BigNumber,
    pi: instanceSymbols.PI,
  };
}

type RangeFn = ((...args: unknown[]) => unknown) & { signatures?: Record<string, unknown> };

/** Instance overrides for #1585 (mathjs zeta / symbolicEqual / range adapters). */
export function g18InstanceOverrides(config: () => G18ParityConfig): {
  zeta: ReturnType<typeof createMathjsZeta>;
  symbolicEqual: ReturnType<typeof createMathjsSymbolicEqual>;
  range: ReturnType<typeof createMathjsRange>;
  rangeEvaluate: ReturnType<typeof createMathjsRangeEvaluate>;
} {
  const range = createMathjsRange({
    nativeRange: mathFunctions.range as RangeFn,
    config,
    typed: g18Typed,
  });
  return {
    zeta: createMathjsZeta(mathjsZetaDeps(config)),
    symbolicEqual: createMathjsSymbolicEqual({ typed: g18Typed }),
    range,
    rangeEvaluate: createMathjsRangeEvaluate(range, g18Typed),
  };
}

const namedZeta = createMathjsZeta(mathjsZetaDeps(() => mathFunctions.config() as G18ParityConfig));
const namedSymbolicEqual = createMathjsSymbolicEqual({ typed: g18Typed });
const namedRange = createMathjsRange({
  nativeRange: mathFunctions.range as RangeFn,
  config: () => mathFunctions.config() as G18ParityConfig,
  typed: g18Typed,
});

export {
  namedBin as bin,
  namedOct as oct,
  namedHex as hex,
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

/** Embedded documentation — byte-identical to mathjs 15.3.0 `create(all).docs` (#G12 F5). */
export const docs = mathjsDocs1530 as Record<string, unknown>;

export { compatReplacer as replacer, compatReviver as reviver } from './serialization.js';

export * from './named-symbols.js';
export * from './native-factory-exports.js';
export * from './constant-factory-exports.js';
export * from './named-physical-constants.generated.js';

const defaultTyped: typeof mathTyped & { isTypedFunction: (value: unknown) => boolean } =
  /* #__PURE__ */ mathFunctions.factory_mathjsCompat.createCompatTyped();
export { defaultTyped as typed };

/** G04 named exports — same unit-relational adapters as `create(all)` (#1552). */
const namedUnitRelational = applyUnitRelationalParity({
  equal: mathFunctions.equal as UnitRelationalOps['equal'],
  unequal: mathFunctions.unequal as UnitRelationalOps['unequal'],
  equalScalar: mathFunctions.equalScalar as UnitRelationalOps['equalScalar'],
  deepEqual: mathFunctions.deepEqual as UnitRelationalOps['deepEqual'],
  compare: mathFunctions.compare as UnitRelationalOps['compare'],
  larger: mathFunctions.larger as UnitRelationalOps['larger'],
  smaller: mathFunctions.smaller as UnitRelationalOps['smaller'],
  largerEq: mathFunctions.largerEq as UnitRelationalOps['largerEq'],
  smallerEq: mathFunctions.smallerEq as UnitRelationalOps['smallerEq'],
});

export const {
  equal,
  unequal,
  equalScalar,
  deepEqual,
  compare,
  larger,
  smaller,
  largerEq,
  smallerEq,
} = namedUnitRelational;
