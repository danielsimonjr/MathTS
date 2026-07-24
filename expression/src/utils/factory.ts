import { pickShallow } from './object.js';
import {
  type LegacyFactory,
  type DependencyName,
  type FactoryMeta,
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
 * re-exported from there. (`FactoryMeta` used to be re-declared locally here
 * despite this comment already claiming it was consolidated — cross-package
 * type-dedup pass, docs/Architecture/duplicate-symbols.json, fixed the
 * comment to match reality.)
 *
 * `factory`/`FactoryFunction`/`CreateFunction` remain DELIBERATELY KEPT LOCAL — NOT
 * safe to redirect: `factory()`'s generic `CreateFunction<TDeps extends
 * Record<string, unknown>, ...>` constraint (core's copy) rejects real call sites
 * across this package (and `functions`) whose destructured dependency objects are
 * typed as plain interfaces without an index signature — confirmed empirically:
 * redirecting it broke `tsc --noEmit` with dozens of TS2345 errors. This mirrors the
 * `functions` package's pre-existing `@typescript-eslint/no-explicit-any`
 * workaround comment on its own local `CreateFunction`, which independently
 * documents the exact same constraint mismatch.
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
 * this package's real `factory()` call sites are never fed through `sortFactories`/
 * `create` in production (both are otherwise-unused mathjs legacy machinery here —
 * every real node/parse factory is wired by hand with an explicit dependency
 * object, e.g. `expression/tests/helpers/bootstrap.ts`), so there is no live
 * dependency graph that could hit the stricter throw.
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
 * Type for the create callback function
 */
export type CreateFunction<TDeps extends object, TResult> = (dependencies: TDeps) => TResult;

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
  TDeps extends object = Record<string, (...args: unknown[]) => unknown>,
  TResult = unknown,
>(
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
export type { LegacyFactory, DependencyName, FactoryMeta };
