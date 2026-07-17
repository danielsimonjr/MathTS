/**
 * BigNumber (decimal.js-shaped) formatting (`format`, `toEngineering`,
 * `toExponential`, `toFixed`).
 *
 * Consolidated onto core: the implementations live once in
 * `@danielsimonjr/mathts-core/internal` (see `../number.ts`/`../object.ts` and the
 * `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../bignumber/formatter.js` imports keep working while the single source of
 * truth lives in core. Proven equivalent to the prior local copy (and to
 * `expression`'s copy) via a fast-check property harness before the redirect —
 * see `functions/tests/dedup-bucketB-equivalence.test.ts`.
 *
 * NOTE: core exports these under an aliased `*BigNumber` name (its `number.ts`
 * already exports `format`/`toEngineering`/`toExponential`/`toFixed` for plain
 * numbers from the same `internal.ts` barrel, so an unaliased re-export would
 * collide); re-exported here under the original local names.
 */
export {
  formatBigNumber as format,
  toEngineeringBigNumber as toEngineering,
  toExponentialBigNumber as toExponential,
  toFixedBigNumber as toFixed,
} from '@danielsimonjr/mathts-core/internal';
