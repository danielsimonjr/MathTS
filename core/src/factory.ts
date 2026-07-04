import { pickShallow } from './object.js';
import { MathjsError } from './error/MathjsError.js';

/**
 * Type for a factory function that creates instances
 */
export interface FactoryFunction<TResult = unknown> {
  (scope: Record<string, unknown>): TResult;
  isFactory: true;
  fn: string;
  dependencies: string[];
  meta?: FactoryMeta;
}

/**
 * Type for legacy factory objects (old-style factories)
 */
export interface LegacyFactory {
  type?: string;
  name: string;
  factory: (...args: unknown[]) => unknown;
  math?: boolean;
  dependencies?: string[];
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
 * Type for dependency names, which can be optional (prefixed with '?')
 */
export type DependencyName = string;

/**
 * Type for the create callback function
 */
export type CreateFunction<TDeps extends Record<string, unknown>, TResult> = (
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
export function factory<
  TDeps extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown,
>(
  name: string,
  dependencies: DependencyName[],
  create: CreateFunction<TDeps, TResult>,
  meta?: FactoryMeta
): FactoryFunction<TResult> {
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

  return assertAndCreate as FactoryFunction<TResult>;
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

  // Separate step: Check all factories for cycles before sorting.
  // This avoids repeating cycle checks during the O(N^2) insertion sort.
  const checkedForCycles = new Set<string>();

  function checkCycles(
    fact: FactoryFunction | LegacyFactory,
    visiting: Set<string>,
    visited: Set<string>
  ) {
    if (isFactory(fact)) {
      const factName = fact.fn;

      if (visiting.has(factName)) {
        throw new Error(`Circular dependency detected: ${factName}`);
      }

      if (visited.has(factName)) {
        return;
      }

      visiting.add(factName);

      fact.dependencies.forEach((d) => {
        const depFactory = factoriesByName[d];
        if (depFactory) {
          checkCycles(depFactory, visiting, visited);
        }
      });

      visiting.delete(factName);
      visited.add(factName);
    }
  }

  // Verify there are no cycles anywhere in the graph
  factories.forEach((factory) => {
    if (isFactory(factory)) {
      checkCycles(factory, new Set(), checkedForCycles);
    }
  });

  function containsDependency(
    factory: FactoryFunction | LegacyFactory,
    dependency: FactoryFunction | LegacyFactory
  ): boolean {
    if (isFactory(factory)) {
      const depName = isFactory(dependency) ? dependency.fn : dependency.name;
      if (factory.dependencies.includes(depName)) {
        return true;
      }

      if (
        factory.dependencies.some((d) => {
          const depFactory = factoriesByName[d];
          return depFactory && containsDependency(depFactory, dependency);
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

/**
 * Test whether an object is a factory. This is the case when it has
 * properties name, dependencies, and a function create.
 * @param obj Any value to test
 * @returns true if obj is a factory function
 */
export function isFactory(obj: unknown): obj is FactoryFunction {
  const f = obj as { fn?: unknown; dependencies?: unknown };
  return typeof obj === 'function' && typeof f.fn === 'string' && Array.isArray(f.dependencies);
}

/**
 * Assert that all dependencies of a list with dependencies are available in the provided scope.
 *
 * Will throw an exception when there are dependencies missing.
 *
 * @param name         Name for the function to be created. Used to generate a useful error message
 * @param dependencies Array of dependency names
 * @param scope        Object containing the available dependencies
 * @throws Error if required dependencies are missing
 */
export function assertDependencies(
  name: string,
  dependencies: DependencyName[],
  scope: Record<string, unknown>
): void {
  const allDefined = dependencies
    .filter((dependency) => !isOptionalDependency(dependency)) // filter optionals
    .every((dependency) => scope[dependency] !== undefined);

  if (!allDefined) {
    const missingDependencies = dependencies.filter(
      (dependency) => scope[dependency] === undefined
    );

    throw new MathjsError(
      `Cannot create function "${name}", ` +
        `some dependencies are missing: ${missingDependencies.map((d) => `"${d}"`).join(', ')}.`
    );
  }
}

/**
 * Check if a dependency is optional (starts with '?')
 * @param dependency The dependency name to check
 * @returns true if the dependency is optional
 */
export function isOptionalDependency(dependency: DependencyName): boolean {
  // `dependency[0]` is `undefined` for an empty string, so no truthiness guard is
  // needed — and the guard made the return type `string | boolean` (`'' | boolean`).
  return dependency[0] === '?';
}

/**
 * Remove the optional notation '?' from a dependency name
 * @param dependency The dependency name
 * @returns The dependency name without optional notation
 */
export function stripOptionalNotation(dependency: DependencyName): string {
  return dependency && dependency[0] === '?' ? dependency.slice(1) : dependency;
}
