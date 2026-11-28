/**
 * mathjs 15.3.0 set operations wired through activated factories.
 *
 * The public `create(all)` instance spreads `@danielsimonjr/mathts-functions`
 * set exports from `typed/set.ts`, which sort with a JSON-based comparator.
 * mathjs matches mixed scalars (including Complex, Fraction, and BigNumber)
 * using `compareNatural`. These bindings come from the same factory graph as a
 * dependency-selected `create({ set*Dependencies })` instance, and they cover
 * every set operation that orders or compares elements.
 *
 * @packageDocumentation
 */
import type * as mathFunctions from '@danielsimonjr/mathts-functions';
import type { CompatCreate, CompatFactoryInput } from './compat-types.js';
import {
  setCartesianDependencies,
  setDifferenceDependencies,
  setDistinctDependencies,
  setIntersectDependencies,
  setIsSubsetDependencies,
  setMultiplicityDependencies,
  setPowersetDependencies,
  setSizeDependencies,
  setSymDifferenceDependencies,
  setUnionDependencies,
} from './native-factory-exports.js';

/** Named set operations that use mathjs factory ordering. */
export type MathjsFactorySetOps = Pick<
  typeof mathFunctions,
  | 'setCartesian'
  | 'setDifference'
  | 'setDistinct'
  | 'setIntersect'
  | 'setIsSubset'
  | 'setMultiplicity'
  | 'setPowerset'
  | 'setSize'
  | 'setSymDifference'
  | 'setUnion'
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
    setDifferenceDependencies,
    setDistinctDependencies,
    setIntersectDependencies,
    setIsSubsetDependencies,
    setMultiplicityDependencies,
    setPowersetDependencies,
    setSizeDependencies,
    setSymDifferenceDependencies,
    setUnionDependencies,
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
  namedSetDifference = ops.setDifference;
  namedSetDistinct = ops.setDistinct;
  namedSetIntersect = ops.setIntersect;
  namedSetIsSubset = ops.setIsSubset;
  namedSetMultiplicity = ops.setMultiplicity;
  namedSetPowerset = ops.setPowerset;
  namedSetSize = ops.setSize;
  namedSetSymDifference = ops.setSymDifference;
  namedSetUnion = ops.setUnion;
}

/** Cartesian product of two (multi)sets with mathjs `compareNatural` ordering. */
export let namedSetCartesian: MathjsFactorySetOps['setCartesian'];

/** Difference of two (multi)sets with mathjs `compareNatural` ordering. */
export let namedSetDifference: MathjsFactorySetOps['setDifference'];

/** Distinct multiset elements with mathjs `compareNatural` ordering. */
export let namedSetDistinct: MathjsFactorySetOps['setDistinct'];

/** Intersection of two (multi)sets with mathjs `compareNatural` ordering. */
export let namedSetIntersect: MathjsFactorySetOps['setIntersect'];

/** Subset test using mathjs `compareNatural` equality. */
export let namedSetIsSubset: MathjsFactorySetOps['setIsSubset'];

/** Element multiplicity using mathjs `compareNatural` equality. */
export let namedSetMultiplicity: MathjsFactorySetOps['setMultiplicity'];

/** Powerset of a (multi)set with mathjs `compareNatural` ordering. */
export let namedSetPowerset: MathjsFactorySetOps['setPowerset'];

/** Multiset size, with unique mode ordered by mathjs `compareNatural`. */
export let namedSetSize: MathjsFactorySetOps['setSize'];

/** Symmetric difference of two (multi)sets with mathjs `compareNatural` ordering. */
export let namedSetSymDifference: MathjsFactorySetOps['setSymDifference'];

/** Union of two (multi)sets with mathjs `compareNatural` ordering. */
export let namedSetUnion: MathjsFactorySetOps['setUnion'];
