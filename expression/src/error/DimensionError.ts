/**
 * Create a range error with the message:
 *     'Dimension mismatch (<actual size> != <expected size>)'
 * Or with a custom message when called with a single string argument.
 *
 * Consolidated onto core: the implementation lives once in
 * `@danielsimonjr/mathts-core/internal` (see `core/src/error/DimensionError.ts` and
 * the `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../error/DimensionError.js` imports keep working while the single source of
 * truth lives in core. Proven equivalent to the prior local copy (and to
 * `functions`' copy) before the redirect — same constructor signature, same
 * message format, same `actual`/`expected`/`relation`/`isDimensionError` fields.
 * `instanceof DimensionError` now holds across package boundaries since there is
 * only one class identity.
 */
export { DimensionError } from '@danielsimonjr/mathts-core/internal';
