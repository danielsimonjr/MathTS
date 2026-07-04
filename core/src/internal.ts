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
