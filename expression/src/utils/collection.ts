/**
 * Cold array/Matrix-aware collection utilities (`deepMap`/`deepForEach` with
 * Matrix-or-array dispatch, dimensional `reduce`, sparse-matrix `scatter`).
 *
 * Consolidated onto core: the implementation lives once in
 * `@danielsimonjr/mathts-core/internal` (see `core/src/collection.ts` and the
 * `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../utils/collection.js` imports keep working while the single source of truth
 * lives in core. Proven equivalent to the prior local copy (and to `functions`'s
 * copy — the two were already functionally IDENTICAL, differing only in comments
 * and one redundant cast) via a fast-check property harness before the redirect —
 * see `functions/tests/dedup-bucketB-equivalence.test.ts`.
 */
export {
  containsCollections,
  deepForEach,
  deepMap,
  reduce,
  scatter,
} from '@danielsimonjr/mathts-core/internal';
