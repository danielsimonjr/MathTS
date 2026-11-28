/**
 * Canonical Node ESM loader for running mathjs v15.3.0 `test/unit-tests` against
 * `@danielsimonjr/mathts-compat` dist. Tests import `src/defaultInstance.js` and
 * named exports from `src/core/create.js`, `src/utils/factory.js`, and
 * `src/error/*.js`; those entry points must resolve to compat, not bare mathjs.
 *
 * Redirecting only `defaultInstance.js` leaves mathjs error classes on the thrown
 * path and breaks `assert.throws(fn, ArgumentsError)` (instance mismatch).
 *
 * @see compat/scripts/run-mathjs-matrix-oracle.mjs
 */

import { pathToFileURL } from 'node:url';

const compatDist = process.env.MATHTS_COMPAT_DIST;
if (!compatDist) {
  throw new Error('MATHTS_COMPAT_DIST must point at compat/dist/index.js');
}

const compatUrl = pathToFileURL(compatDist).href;

/** Resolved module URLs that must map to compat `dist/index.js`. */
const REDIRECT_SUFFIXES = [
  '/src/defaultInstance.js',
  '/src/core/create.js',
  '/src/utils/factory.js',
  '/src/error/ArgumentsError.js',
  '/src/error/DimensionError.js',
  '/src/error/IndexError.js',
];

/**
 * Node resolve hook — replace mathjs public entry modules with compat dist.
 *
 * @param {string} specifier
 * @param {import('node:module').ResolveHookContext} context
 * @param {import('node:module').ResolveHook} nextResolve
 */
export async function resolve(specifier, context, nextResolve) {
  const res = await nextResolve(specifier, context);
  if (REDIRECT_SUFFIXES.some((suffix) => res.url.endsWith(suffix))) {
    return { url: compatUrl, shortCircuit: true };
  }
  return res;
}