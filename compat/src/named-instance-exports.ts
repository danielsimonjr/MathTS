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
 * This module intentionally imports `create` and `all` from `./index.js` in a
 * module cycle: its module body never touches them (only the lazy
 * `getDefaultInstance` does), so either evaluation order is safe.
 *
 * @packageDocumentation
 */
import { embeddedDocs } from '@danielsimonjr/mathts-expression';
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { createChain } from './chain.js';
import {
  createCompatFormat,
  createCompatPrint,
  createCompatString,
} from './fraction-format-parity.js';
import { MATHJS_PARITY_NAMES } from './parity-names.generated.js';
import { create, all } from './index.js';
import type { MathInstance, MathJSConfig } from './index.js';

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
} as const satisfies MathJSConfig;

export { moduleDefaults };

let defaultInstance: MathInstance | undefined;

function getDefaultInstance(): MathInstance {
  return (defaultInstance ??= create(all, moduleDefaults));
}

/** Evaluate an expression or a collection in the default compatibility instance. */
const defaultEvaluate = ((...args: unknown[]) =>
  (getDefaultInstance().evaluate as (...args: unknown[]) => unknown)(
    ...args
  )) as MathInstance['evaluate'];

/** Compile an expression or a collection in the default compatibility instance. */
const defaultCompile = ((...args: unknown[]) =>
  (getDefaultInstance().compile as (...args: unknown[]) => unknown)(
    ...args
  )) as MathInstance['compile'];

/** Parse an expression into a mathjs-compatible syntax tree. */
const defaultParse: MathInstance['parse'] = /* #__PURE__ */ new Proxy(mathFunctions.parse, {
  get: (target, key, receiver) =>
    typeof key === 'string' && key.startsWith('is')
      ? Reflect.get(getDefaultInstance().parse, key)
      : Reflect.get(target, key, receiver),
  apply: (_target, receiver, args) => Reflect.apply(getDefaultInstance().parse, receiver, args),
});

/** Stateful expression parser for the default compatibility instance. */
export const Parser = function Parser(options?: Parameters<MathInstance['parser']>[0]): object {
  if (new.target === undefined) throw new TypeError('Parser must be constructed with new');
  return Reflect.construct(getDefaultInstance().Parser, [options], new.target);
} as unknown as MathInstance['Parser'];

/** Create a compatibility parser with its own retained scope. */
const defaultParser: MathInstance['parser'] = (options) => new Parser(options);

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
const defaultChain: MathInstance['chain'] = /* #__PURE__ */ (() => defaultChainApi.chain)();

/** Chain constructor that uses the default compatibility instance. */
const defaultChainConstructor: MathInstance['Chain'] = /* #__PURE__ */ (() =>
  defaultChainApi.Chain)();

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
  (settings?: Partial<MathJSConfig>) => {
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
};

/** Embedded documentation for names in the MathJS compatibility surface. */
export const docs = /* #__PURE__ */ Object.fromEntries(
  Object.entries(embeddedDocs).filter(([name]) => MATHJS_PARITY_NAMES.includes(name))
);

const defaultTyped: MathInstance['typed'] =
  /* #__PURE__ */ mathFunctions.factory_mathjsCompat.createCompatTyped();
export { defaultTyped as typed };
