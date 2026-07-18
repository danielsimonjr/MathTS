/**
 * Internal shared utilities, exposed via the `@danielsimonjr/mathts-core/internal`
 * subpath export so downstream packages (functions, expression) build on ONE copy
 * of the type guards, number formatting/parsing, and object helpers instead of each
 * maintaining a drifting fork.
 *
 * This is deliberately NOT part of core's main public API (`.`), which stays focused
 * on the numeric types, typed-function integration, and factory. These are lower-level
 * helpers shared across the monorepo. See the `project-all-libraries-build-on-core`
 * principle: keep the implementation in the standard layer once and let it propagate.
 */
export * from './is.js';
export * from './number.js';
export * from './object.js';
export { hasOwnProperty, endsWith, warnOnce, memoize } from './shared.js';
export type { MemoizedFunction } from './shared.js';

// mathjs-compatible tolerance/matrix/number config (ConfigOptions/DEFAULT_CONFIG),
// consolidated from the byte-identical copy formerly in
// `functions/src/core/config.ts` (see the cross-package dedup pass,
// docs/Architecture/duplicate-symbols.json). Distinct from — and NOT to be
// confused with — the publicly-exported `MathTSConfig`/`DEFAULT_CONFIG` from
// `./factory/factory.ts` (the factory-registry/backend-routing config); the two
// serve different subsystems and are intentionally NOT merged.
export type { ConfigOptions, MathJsConfig } from './config.js';
export { DEFAULT_CONFIG } from './config.js';

// Error classes (Bucket B, commit 1), consolidated from the 2-3 way duplicated
// copies formerly in expression/src/error/{MathjsError,DimensionError,IndexError}.ts
// and functions/src/error/{MathjsError,DimensionError,IndexError}.ts. Verified
// behaviorally identical across all three prior copies (same constructor signature,
// same message format, same custom fields); expression and functions now re-export
// these as shims, so `instanceof DimensionError`/`instanceof IndexError` holds across
// package boundaries. `createIndexError` is the back-compat factory form that
// originated in functions' copy.
export { MathjsError } from './error/MathjsError.js';
export { DimensionError } from './error/DimensionError.js';
export { IndexError, createIndexError } from './error/IndexError.js';

// mathjs-style factory helpers (name-sorted DAG loader), consolidated from the
// duplicate copies formerly in expression/src/utils/factory.ts and
// functions/src/utils/factory.ts. `isFactory`/`assertDependencies`/
// `isOptionalDependency`/`stripOptionalNotation` were adopted in Bucket B slice 1;
// `sortFactories`/`create` are now ALSO adopted (Bucket B, commit 2) — this file's
// `sortFactories` throws on ANY circular dependency (direct or indirect; see
// `core/tests/factory-sort.test.ts`), which was a proven behavioral fix over the two
// packages' former local copies (which only special-cased direct 2-cycles and
// otherwise silently broke longer cycles via a visited-set guard without throwing).
// Verified neither package's real factory-registration graph contains an actual
// cycle before adopting core's stricter version — see
// `functions/tests/dedup-bucketB-equivalence.test.ts` and each package's
// `tests/utils-factory.test.ts`.
//
// `factory()`/`FactoryFunction`/`CreateFunction` remain DELIBERATELY LOCAL to each
// package — core's stricter `CreateFunction<TDeps extends Record<string, unknown>>`
// constraint rejects real call sites (see slice 1's note); only `sortFactories`/
// `create` (which don't depend on that generic) are shared here.
export * from './factory.js';

// Generic-value string formatting, consolidated from expression/src/utils/string.ts
// and functions/src/utils/string.ts. Aliased to `formatGeneric` because `./number.js`
// already exports a `format` (for plain numbers) from this same barrel via `export *`
// above — an unaliased `export *` here would collide (TS2308).
export {
  format as formatGeneric,
  stringify,
  escape,
  compareText,
  type GeneralFormatOptions,
} from './string.js';

// BigNumber (decimal.js-shaped) formatting, consolidated from
// expression/src/utils/bignumber/formatter.ts and functions/src/utils/bignumber/formatter.ts.
// Aliased for the same reason as the string formatter above: `./number.js` already exports
// `format`/`toEngineering`/`toExponential`/`toFixed` for plain numbers.
export {
  format as formatBigNumber,
  toEngineering as toEngineeringBigNumber,
  toExponential as toExponentialBigNumber,
  toFixed as toFixedBigNumber,
  type BigNumberValue,
} from './bignumber-formatter.js';

// Unit factory type contract (relocated here as the Unit merges into core; consumed
// by the mathjs-derived Unit while it still lives in the functions package).
export type * from './types/unit/unit-types.js';

// The relocated, feature-complete Unit — the factory, its core-wired dependency
// bundle, and a ready-instantiated class — for the functions package to adopt as it
// retires its own copy (Unit-merge Phase 3). `CoreUnit` is the value export; the
// `Unit` *type* continues to come from `is.js`.
export { createUnitClass, unitDependencies, Unit as CoreUnit } from './types/unit/index.js';

// Cold array/collection/map utilities (Bucket B slice 2), consolidated from the
// duplicate copies formerly in expression/src/utils/{array,collection,map}.ts and
// functions/src/utils/{array,collection,map}.ts. See each source file's header for
// the divergences found and reconciled (map.ts's `[Symbol.iterator]` type-soundness
// fix; array.ts's expression-only `initial`).
//
// Explicit named exports (no `export *`) because array.ts and collection.ts each
// define their OWN `deepMap`/`deepForEach` (array-level vs. Matrix-or-array-aware
// level — collection.ts's versions dispatch to array.ts's under the hood), and
// array.ts's `clone`/`get` collide in name (but not in meaning) with `object.ts`'s
// generic `clone`/`get` already exported above. Aliased below to keep every name
// in this barrel unambiguous; collection.ts's `deepMap`/`deepForEach` keep the
// plain names since they are the ones most call sites want (Matrix-aware).
export type { NestedArray, IdentifiedValue } from './array.js';
export {
  arraySize,
  validate,
  validateIndexSourceSize,
  validateIndex,
  isEmptyIndex,
  resize,
  reshape,
  processSizesWildcard,
  squeeze,
  unsqueeze,
  flatten,
  map,
  forEach,
  filter,
  filterRegExp,
  join,
  identify,
  generalize,
  getArrayDataType,
  last,
  initial,
  concat,
  broadcastSizes,
  checkBroadcastingRules,
  broadcastTo,
  broadcastArrays,
  stretch,
  get as getArrayElement,
  deepMap as deepMapArray,
  deepForEach as deepForEachArray,
  clone as cloneArray,
} from './array.js';

export { containsCollections, deepMap, deepForEach, reduce, scatter } from './collection.js';

export {
  ObjectWrappingMap,
  PartitionedMap,
  createEmptyMap,
  createMap,
  toObject,
  assign as assignMap,
  isObjectWrappingMap,
} from './map.js';
