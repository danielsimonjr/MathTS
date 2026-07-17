/**
 * A `Map`-facade over a bare object (`ObjectWrappingMap`), a two-partition
 * `Map` (`PartitionedMap`), and small `Map`/object interop helpers
 * (`createMap`/`createEmptyMap`/`assign`).
 *
 * Consolidated onto core: the implementation lives once in
 * `@danielsimonjr/mathts-core/internal` (see `core/src/map.ts` and the
 * `project-all-libraries-build-on-core` principle). Thin re-export so existing
 * `../utils/map.js` imports keep working while the single source of truth lives
 * in core. Proven equivalent to the prior local copy (and to `expression`'s copy)
 * via a fast-check property harness before the redirect — see
 * `functions/tests/dedup-bucketB-equivalence.test.ts`.
 *
 * TWO divergences were found and reconciled onto core (see `core/src/map.ts`'s
 * header for the full writeup):
 *  1. `[Symbol.iterator]` — THIS package's prior copy already declared it as a
 *     real, correctly-typed class method (the fix `expression`'s copy was
 *     missing); core's canonical adopts this package's version unchanged.
 *  2. `createEmptyMap`/`createMap`'s generic default (`K = unknown` here vs.
 *     `K = string` in `expression`) — a compile-time-only inference default with
 *     no behavioral difference; reconciled to core's `K = string` (matching
 *     `ObjectWrappingMap`/`PartitionedMap`'s own `K = string` default already
 *     shared by both packages). No call site in this package relies on the
 *     `K = unknown` default (checked: `functions/src/algebra/simplify.ts`'s
 *     `createEmptyMap()` call is assigned to an explicitly `Map<string, unknown>`-
 *     typed parameter default, which `Map<string, unknown>` satisfies directly).
 *
 * This package never had `toObject` (unlike `expression`'s prior copy, consumed
 * by its `Parser.ts`), so it is intentionally not re-exported here — this shim
 * preserves exactly the original export surface.
 */
export {
  ObjectWrappingMap,
  PartitionedMap,
  createEmptyMap,
  createMap,
  assignMap as assign,
  isObjectWrappingMap,
} from '@danielsimonjr/mathts-core/internal';
