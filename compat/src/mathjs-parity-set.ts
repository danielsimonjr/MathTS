/**
 * mathjs 15.3.0 set operations wired through activated factories.
 *
 * The public `create(all)` instance spreads `@danielsimonjr/mathts-functions`
 * set exports from `typed/set.ts`, which sort with a JSON-based comparator.
 * mathjs matches mixed scalars (including Complex) using `compareNatural`.
 * These bindings come from the same factory graph as a dependency-selected
 * `create({ set*Dependencies })` instance.
 *
 * @packageDocumentation
 */
import type * as mathFunctions from '@danielsimonjr/mathts-functions';
import type { CompatCreate, CompatFactoryInput } from './compat-types.js';
import {
  setCartesianDependencies,
  setDistinctDependencies,
  setIntersectDependencies,
  setPowersetDependencies,
} from './native-factory-exports.js';

/** Named set operations that use mathjs factory ordering. */
export type MathjsFactorySetOps = Pick<
  typeof mathFunctions,
  'setCartesian' | 'setDistinct' | 'setIntersect' | 'setPowerset'
>;

let createInstance: CompatCreate | undefined;

let cached: MathjsFactorySetOps | undefined;

function getFactorySetOps(): MathjsFactorySetOps {
  if (!createInstance) {
    throw new Error('compat factory set source is not bound by src/index.ts');
  }
  const create = createInstance as (factories: CompatFactoryInput) => Record<string, unknown>;
  return (cached ??= create({
    setCartesianDependencies,
    setDistinctDependencies,
    setIntersectDependencies,
    setPowersetDependencies,
  }) as MathjsFactorySetOps);
}

/**
 * Receive `create` from `src/index.ts` at module bind time and materialize set factories.
 *
 * @param create - The compat `create` function.
 */
export function bindMathjsFactorySetSource(create: CompatCreate): void {
  createInstance = create;
  const ops = getFactorySetOps();
  namedSetCartesian = ops.setCartesian;
  namedSetDistinct = ops.setDistinct;
  namedSetIntersect = ops.setIntersect;
  namedSetPowerset = ops.setPowerset;
}

/** Cartesian product of two (multi)sets with mathjs `compareNatural` ordering. */
export let namedSetCartesian: MathjsFactorySetOps['setCartesian'];

/** Distinct multiset elements with mathjs `compareNatural` ordering. */
export let namedSetDistinct: MathjsFactorySetOps['setDistinct'];

/** Intersection of two (multi)sets with mathjs `compareNatural` ordering. */
export let namedSetIntersect: MathjsFactorySetOps['setIntersect'];

/** Powerset of a (multi)set with mathjs `compareNatural` ordering. */
export let namedSetPowerset: MathjsFactorySetOps['setPowerset'];
