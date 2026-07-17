import { pickShallow } from './object.js';
import {
  type LegacyFactory,
  type DependencyName,
  isFactory,
  assertDependencies,
  isOptionalDependency,
  stripOptionalNotation,
} from '@danielsimonjr/mathts-core/internal';

/**
 * Some of this file's helpers are consolidated onto core (see the re-exports at
 * the bottom): `isFactory`, `assertDependencies`, `isOptionalDependency`,
 * `stripOptionalNotation`, and the plain-data types `LegacyFactory`/`FactoryMeta`/
 * `DependencyName` are byte-for-byte equivalent to
 * `@danielsimonjr/mathts-core/internal`'s copies (proven via a fast-check property
 * harness — see `functions/tests/dedup-bucketB-equivalence.test.ts`) and are
 * re-exported from there.
 *
 * `factory`/`FactoryFunction`/`CreateFunction` and `sortFactories`/`create` are
 * DELIBERATELY KEPT LOCAL — NOT safe to redirect:
 *  - `factory()`'s generic `CreateFunction<TDeps extends Record<string, unknown>, ...>`
 *    constraint (core's copy) rejects real call sites across this package (259+
 *    activated mathjs-factory call sites in `functions/src/{arithmetic,algebra,...}`)
 *    whose destructured dependency objects are typed as plain interfaces without an
 *    index signature — confirmed empirically: redirecting it broke `tsc --noEmit`
 *    (the same failure mode reproduced first in `expression`, which has 46 call
 *    sites). This is exactly the constraint mismatch this package's own pre-existing
 *    `@typescript-eslint/no-explicit-any` comment on `CreateFunction`/`factory`
 *    documents — this package already worked around it with `any`; core's copy
 *    uses the stricter `Record<string, unknown>` and cannot be swapped in as-is.
 *  - `sortFactories`/`create`: core's `sortFactories` throws on ANY circular
 *    dependency (direct or indirect; see `core/tests/factory-sort.test.ts`),
 *    whereas this copy only special-cases direct 2-cycles (silently preserving
 *    input order) and otherwise breaks longer cycles via a visited-set guard
 *    without throwing — a proven runtime behavioral divergence.
 * Both divergences are reported, not silently resolved — see the dedup
 * equivalence test's "PROVEN DIVERGENCE" block and the consolidation commit
 * message for the adjudication note.
 */

/**
 * Type for a factory function that creates instances
 */
export interface FactoryFunction<_TDeps = unknown, TResult = unknown> {
  (scope: Record<string, unknown>): TResult;
  isFactory: true;
  fn: string;
  dependencies: string[];
  meta?: FactoryMeta;
}

/**
 * Meta information that can be attached to a factory
 */
export interface FactoryMeta {
  /**
   * If true, the factory will be recreated when config changes
   */
  recreateOnConfigChange?: boolean;
  /**
   * If true, this is a lazy factory that should only be created when needed
   */
  lazy?: boolean;
  /**
   * Additional custom metadata
   */
  [key: string]: unknown;
}

/**
 * Type for the create callback function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the dependency-object constraint must accept interface types that lack an index signature (e.g. `{ typed: TypedFunction }`); `Record<string, unknown>` would reject every such factory's deps. `any` is the only constraint that admits them.
export type CreateFunction<TDeps extends Record<string, any>, TResult> = (
  dependencies: TDeps
) => TResult;

/**
 * Create a factory function, which can be used to inject dependencies.
 *
 * The created functions are memoized, a consecutive call of the factory
 * with the exact same inputs will return the same function instance.
 * The memoized cache is exposed on `factory.cache` and can be cleared
 * if needed.
 *
 * Example:
 *
 *     const name = 'log'
 *     const dependencies = ['config', 'typed', 'divideScalar', 'Complex']
 *
 *     export const createLog = factory(name, dependencies, ({ typed, config, divideScalar, Complex }) => {
 *       // ... create the function log here and return it
 *     }
 *
 * @param name           Name of the function to be created
 * @param dependencies   The names of all required dependencies
 * @param create         Callback function called with an object with all dependencies
 * @param meta           Optional object with meta information that will be attached
 *                       to the created factory function as property `meta`. For explanation
 *                       of what meta properties can be specified and what they mean, see
 *                       docs/core/extension.md.
 * @returns The factory function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped factories (the majority across the package) rely on the `any` TDeps default so their destructured dependencies resolve to a usable type rather than `unknown`; tightening this would require annotating every factory's deps object across all packages.
export function factory<TDeps extends Record<string, any> = any, TResult = any>(
  name: string,
  dependencies: DependencyName[],
  create: CreateFunction<TDeps, TResult>,
  meta?: FactoryMeta
): FactoryFunction<TDeps, TResult> {
  function assertAndCreate(scope: Record<string, unknown>): TResult {
    // we only pass the requested dependencies to the factory function
    // to prevent functions to rely on dependencies that are not explicitly
    // requested.
    const deps = pickShallow(scope, dependencies.map(stripOptionalNotation)) as TDeps;

    assertDependencies(name, dependencies, scope);

    return create(deps);
  }

  assertAndCreate.isFactory = true as const;
  assertAndCreate.fn = name;
  assertAndCreate.dependencies = dependencies.slice().sort();
  if (meta) {
    assertAndCreate.meta = meta;
  }

  return assertAndCreate as FactoryFunction<TDeps, TResult>;
}

/**
 * Sort all factories such that when loading in order, the dependencies are resolved.
 *
 * @param factories Array of factory functions or legacy factories
 * @returns Returns a new array with the sorted factories
 */
export function sortFactories(
  factories: Array<FactoryFunction | LegacyFactory>
): Array<FactoryFunction | LegacyFactory> {
  const factoriesByName: Record<string, FactoryFunction | LegacyFactory> = {};

  factories.forEach((factory) => {
    const name = isFactory(factory) ? factory.fn : factory.name;
    factoriesByName[name] = factory;
  });

  // Check if there's a circular dependency between two factories
  function hasCircularDependency(
    factory1: FactoryFunction | LegacyFactory,
    factory2: FactoryFunction | LegacyFactory
  ): boolean {
    if (!isFactory(factory1) || !isFactory(factory2)) {
      return false;
    }

    const name1 = factory1.fn;
    const name2 = factory2.fn;

    // Check if factory1 depends on factory2 AND factory2 depends on factory1
    return factory1.dependencies.includes(name2) && factory2.dependencies.includes(name1);
  }

  function containsDependency(
    factory: FactoryFunction | LegacyFactory,
    dependency: FactoryFunction | LegacyFactory,
    visited: Set<string> = new Set()
  ): boolean {
    if (isFactory(factory)) {
      // Detect circular references by tracking visited factories
      const factoryName = factory.fn;
      if (visited.has(factoryName)) {
        // Circular dependency detected - return false to avoid infinite recursion
        return false;
      }

      const depName = isFactory(dependency) ? dependency.fn : dependency.name;

      // If there's a circular dependency, don't reorder (preserve input order)
      if (hasCircularDependency(factory, dependency)) {
        return false;
      }

      if (factory.dependencies.includes(depName)) {
        return true;
      }

      // Mark this factory as visited before recursing
      visited.add(factoryName);

      if (
        factory.dependencies.some((d) => {
          const depFactory = factoriesByName[d];
          return depFactory && containsDependency(depFactory, dependency, visited);
        })
      ) {
        return true;
      }
    }

    return false;
  }

  const sorted: Array<FactoryFunction | LegacyFactory> = [];

  function addFactory(factory: FactoryFunction | LegacyFactory): void {
    let index = 0;
    while (index < sorted.length && !containsDependency(sorted[index], factory)) {
      index++;
    }

    sorted.splice(index, 0, factory);
  }

  // sort regular factory functions
  factories.filter(isFactory).forEach(addFactory);

  // sort legacy factory functions AFTER the regular factory functions
  factories.filter((factory) => !isFactory(factory)).forEach(addFactory);

  return sorted;
}

// TODO: comment or cleanup if unused in the end
export function create(
  factories: Array<FactoryFunction | LegacyFactory>,
  scope: Record<string, unknown> = {}
): Record<string, unknown> {
  sortFactories(factories).forEach((factory) => {
    if (isFactory(factory)) {
      factory(scope);
    }
  });

  return scope;
}

export { isFactory, assertDependencies, isOptionalDependency, stripOptionalNotation };
export type { LegacyFactory, DependencyName };
