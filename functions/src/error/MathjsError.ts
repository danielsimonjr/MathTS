/**
 * Custom error type for Mathjs errors.
 *
 * Consolidated onto core: the implementation lives once in
 * `@danielsimonjr/mathts-core/internal` (see `core/src/error/MathjsError.ts` and the
 * `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../error/MathjsError.js` imports keep working while the single source of truth
 * lives in core. Proven equivalent to the prior local copy (and to `expression`'s
 * copy) before the redirect — same constructor signature, same `.message`/`.name`/
 * `isMathjsError` field. `instanceof MathjsError` now holds across package
 * boundaries since there is only one class identity.
 */
export { MathjsError } from '@danielsimonjr/mathts-core/internal';
