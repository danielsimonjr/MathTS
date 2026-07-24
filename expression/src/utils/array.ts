/**
 * Cold array utilities (size/validate/reshape/resize/squeeze/broadcast/deepMap/
 * deepForEach/clone/...).
 *
 * Consolidated onto core: the implementation lives once in
 * `@danielsimonjr/mathts-core/internal` (see `core/src/array.ts` and the
 * `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../utils/array.js` imports keep working while the single source of truth lives
 * in core. Proven equivalent to the prior local copy (and to `functions`'s copy)
 * via a fast-check property harness before the redirect — see
 * `functions/tests/dedup-bucketB-equivalence.test.ts`.
 *
 * `initial` was ONLY ever defined in THIS package's prior copy (dead code even
 * here — unused outside its own definition); re-exported here for back-compat,
 * even though `functions` never had it and doesn't get it in its own shim.
 *
 * core re-exports this file's `clone`/`get`/`deepMap`/`deepForEach` under aliased
 * names (`cloneArray`/`getArrayElement`/`deepMapArray`/`deepForEachArray`) to avoid
 * collisions with `object.ts`'s generic `clone`/`get` and `collection.ts`'s
 * Matrix-aware `deepMap`/`deepForEach` in its own barrel — re-imported here under
 * THIS file's original local names.
 */
export type { NestedArray, IdentifiedValue } from '@danielsimonjr/mathts-core/internal';
export {
  arraySize,
  validate,
  validateIndexSourceSize,
  validateIndex,
  isEmptyIndex,
  resize,
  reshape,
  processSizesWildcard,
  squeeze,
  unsqueeze,
  flatten,
  map,
  forEach,
  filter,
  filterRegExp,
  join,
  identify,
  generalize,
  getArrayDataType,
  last,
  initial,
  concat,
  broadcastSizes,
  checkBroadcastingRules,
  broadcastTo,
  broadcastArrays,
  stretch,
  getArrayElement as get,
  deepMapArray as deepMap,
  deepForEachArray as deepForEach,
  cloneArray as clone,
} from '@danielsimonjr/mathts-core/internal';
