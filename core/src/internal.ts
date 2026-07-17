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

// mathjs-style factory helpers (name-sorted DAG loader), consolidated from the
// duplicate copies formerly in expression/src/utils/factory.ts and
// functions/src/utils/factory.ts. NOTE: `sortFactories`/`create` are deliberately
// NOT re-exported here — this file's `sortFactories` throws on ANY circular
// dependency (direct or indirect; see core/tests/factory-sort.test.ts), which is a
// proven behavioral DIVERGENCE from the two packages' local copies (which only
// special-case direct 2-cycles and otherwise silently break cycles without
// throwing). Each package keeps its own `sortFactories`/`create` local pending
// adjudication — see functions/tests/dedup-bucketB-equivalence.test.ts.
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
