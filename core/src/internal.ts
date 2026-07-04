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

// Unit factory type contract (relocated here as the Unit merges into core; consumed
// by the mathjs-derived Unit while it still lives in the functions package).
export type * from './types/unit/unit-types.js';

// The relocated, feature-complete Unit — the factory, its core-wired dependency
// bundle, and a ready-instantiated class — for the functions package to adopt as it
// retires its own copy (Unit-merge Phase 3). `CoreUnit` is the value export; the
// `Unit` *type* continues to come from `is.js`.
export { createUnitClass, unitDependencies, Unit as CoreUnit } from './types/unit/index.js';
