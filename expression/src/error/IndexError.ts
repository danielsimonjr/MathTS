/**
 * Custom error type for index out of range errors.
 *
 * Consolidated onto core: the implementation lives once in
 * `@danielsimonjr/mathts-core/internal` (see `core/src/error/IndexError.ts` and the
 * `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../error/IndexError.js` imports keep working while the single source of truth
 * lives in core. Proven equivalent to the prior local copy (and to `functions`'
 * copy) before the redirect — same constructor signature, same message format,
 * same `index`/`min`/`max`/`isIndexError` fields, plus the `createIndexError`
 * back-compat factory form. `instanceof IndexError` now holds across package
 * boundaries since there is only one class identity.
 *
 * @extends RangeError
 */
export { IndexError, createIndexError } from '@danielsimonjr/mathts-core/internal';
