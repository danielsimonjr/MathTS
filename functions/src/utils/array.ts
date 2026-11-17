/**
 * Cold array utilities (size/validate/reshape/resize/squeeze/broadcast/deepMap/
 * deepForEach/clone/...).
 *
 * Consolidated onto core: the implementation lives once in
 * `@danielsimonjr/mathts-core/internal` (see `core/src/array.ts` and the
 * `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../utils/array.js` imports keep working while the single source of truth lives
 * in core. Proven equivalent to the prior local copy (and to `expression`'s copy)
 * via a fast-check property harness before the redirect — see
 * `functions/tests/dedup-bucketB-equivalence.test.ts`.
 *
 * This package never had `initial` (unlike `expression`'s prior copy, where it was
 * dead code even there), so it is intentionally not re-exported here — this shim
 * preserves exactly the original export surface.
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
