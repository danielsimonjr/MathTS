/**
 * A `Map`-facade over a bare object (`ObjectWrappingMap`), a two-partition
 * `Map` (`PartitionedMap`), and small `Map`/object interop helpers
 * (`createMap`/`createEmptyMap`/`toObject`/`assign`).
 *
 * Consolidated onto core: the implementation lives once in
 * `@danielsimonjr/mathts-core/internal` (see `core/src/map.ts` and the
 * `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../utils/map.js` imports keep working while the single source of truth lives
 * in core. Proven equivalent to the prior local copy (and to `functions`'s copy)
 * via a fast-check property harness before the redirect — see
 * `functions/tests/dedup-bucketB-equivalence.test.ts`.
 *
 * TWO divergences were found and reconciled onto core (see `core/src/map.ts`'s
 * header for the full writeup):
 *  1. `[Symbol.iterator]` — THIS package's prior copy assigned it dynamically via
 *     a type-erasing cast, which type-checked but was a latent `implements Map<K,
 *     V>` lie (TS2420 downstream under `skipLibCheck: false`). core's canonical
 *     uses `functions`'s already-fixed, correctly-typed version — a genuine
 *     bug fix, not a style change, and this redirect FIXES the latent bug here.
 *  2. `createEmptyMap`/`createMap`'s generic default (`K = string` here vs.
 *     `K = unknown` in `functions`) — a compile-time-only inference default with
 *     no behavioral difference; reconciled to `K = string` (this package's
 *     original default, matching `ObjectWrappingMap`/`PartitionedMap`'s own
 *     `K = string` default already shared by both packages).
 *
 * `toObject` is consumed by `expression/src/Parser.ts` and re-exported here;
 * `functions` never had it and doesn't get it in its own shim.
 */
export {
  ObjectWrappingMap,
  PartitionedMap,
  createEmptyMap,
  createMap,
  toObject,
  assignMap as assign,
  isObjectWrappingMap,
} from '@danielsimonjr/mathts-core/internal';
