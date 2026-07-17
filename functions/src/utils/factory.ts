import { pickShallow } from './object.js';
import {
  type LegacyFactory,
  type DependencyName,
  isFactory,
  assertDependencies,
  isOptionalDependency,
  stripOptionalNotation,
  sortFactories as coreSortFactories,
  create as coreCreate,
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
 * `factory`/`FactoryFunction`/`CreateFunction` remain DELIBERATELY KEPT LOCAL — NOT
 * safe to redirect: `factory()`'s generic `CreateFunction<TDeps extends
 * Record<string, unknown>, ...>` constraint (core's copy) rejects real call sites
 * across this package (259+ activated mathjs-factory call sites in
 * `functions/src/{arithmetic,algebra,...}`) whose destructured dependency objects
 * are typed as plain interfaces without an index signature — confirmed
 * empirically: redirecting it broke `tsc --noEmit` (the same failure mode
 * reproduced first in `expression`, which has 46 call sites). This is exactly the
 * constraint mismatch this package's own pre-existing
 * `@typescript-eslint/no-explicit-any` comment on `CreateFunction`/`factory`
 * documents — this package already worked around it with `any`; core's copy uses
 * the stricter `Record<string, unknown>` and cannot be swapped in as-is.
 *
 * `sortFactories`/`create` are now ADOPTED from core (Bucket B, commit 2): they
 * don't depend on `factory()`'s generic constraint (they only operate on already-
 * constructed `FactoryFunction`/`LegacyFactory` values), so they aren't blocked by
 * the divergence above. Core's `sortFactories` throws on ANY circular dependency —
 * direct or indirect (see `core/tests/factory-sort.test.ts`) — which is a
 * deliberate fix over this file's FORMER local copy, which only special-cased
 * direct 2-cycles and otherwise silently broke longer cycles via a visited-set
 * guard without throwing (see `functions/tests/dedup-bucketB-equivalence.test.ts`'s
 * former "PROVEN DIVERGENCE" block, now updated to reflect the adoption). Verified
 * this package's real `factory()` call sites (all 251 of them) are never fed
 * through `sortFactories`/`create` in production (both are otherwise-unused mathjs
 * legacy machinery here — every real activated factory is wired by hand via
 * `functions/src/factories/scope.ts` + `functions/src/factories/index.ts`, not a
 * name-sorted DAG load), so there is no live dependency graph that could hit the
 * stricter throw.
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

// `sortFactories`/`create` are adopted straight from `@danielsimonjr/mathts-core/internal`
// (Bucket B, commit 2) — see this file's header comment. A pure re-export (not a
// locally-typed wrapper): both operate only on already-constructed `FactoryFunction`/
// `LegacyFactory` values, so core's signature is a clean drop-in.
export { isFactory, assertDependencies, isOptionalDependency, stripOptionalNotation };
export { coreSortFactories as sortFactories, coreCreate as create };
export type { LegacyFactory, DependencyName };
