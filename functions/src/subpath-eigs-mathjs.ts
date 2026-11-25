/**
 * Subpath entry: mathjs 15.3.0-shaped `eigs` factory only (#1561 compat adapter).
 * Not re-exported from the main package entry — keeps the mathjs eigs port off the
 * eager `@danielsimonjr/mathts-functions` import graph for consumers who only need
 * the native `eigs` export.
 */
export { eigsMathjsFactory } from './factories/index.js';
