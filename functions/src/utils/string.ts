/**
 * Generic-value string formatting (`format`, `stringify`, `compareText`).
 *
 * Consolidated onto core: the implementations live once in
 * `@danielsimonjr/mathts-core/internal` (see `number.ts`/`object.ts` and the
 * `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../utils/string.js` imports keep working while the single source of truth
 * lives in core. Proven equivalent to the prior local copy (and to `expression`'s
 * copy) via a fast-check property harness before the redirect — see
 * `functions/tests/dedup-bucketB-equivalence.test.ts`.
 *
 * NOTE: core exports the generic `format` here as `formatGeneric` (its `number.ts`
 * already exports a `format` for plain numbers from the same `internal.ts` barrel,
 * so an unaliased re-export would collide); re-exported here under the original
 * local name `format`. This package never had `escape`/`endsWith` in this file
 * (unlike `expression`'s prior copy), so they are intentionally not re-exported
 * here — this shim preserves exactly the original export surface.
 */
export {
  formatGeneric as format,
  stringify,
  compareText,
  type GeneralFormatOptions,
} from '@danielsimonjr/mathts-core/internal';
