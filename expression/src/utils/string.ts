/**
 * Generic-value string formatting (`format`, `stringify`, `compareText`, `escape`)
 * and `endsWith`.
 *
 * Consolidated onto core: the implementations live once in
 * `@danielsimonjr/mathts-core/internal` (see `number.ts`/`object.ts` and the
 * `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../utils/string.js` imports keep working while the single source of truth
 * lives in core. Proven equivalent to the prior local copy (and to `functions`'s
 * copy) via a fast-check property harness before the redirect — see
 * `functions/tests/dedup-bucketB-equivalence.test.ts`. `endsWith` was ALSO
 * locally defined here pre-redirect, and was already identical to (hence
 * redundant with) `./shared.ts`'s `endsWith` — already canonical in core.
 *
 * NOTE: core exports the generic `format` here as `formatGeneric` (its `number.ts`
 * already exports a `format` for plain numbers from the same `internal.ts` barrel,
 * so an unaliased re-export would collide); re-exported here under the original
 * local name `format`.
 */
export {
  endsWith,
  formatGeneric as format,
  stringify,
  escape,
  compareText,
} from '@danielsimonjr/mathts-core/internal';
