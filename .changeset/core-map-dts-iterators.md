---
'@danielsimonjr/mathts-core': patch
---

Fix the published `dist/map.d.ts` for consumers that compile with `skipLibCheck: false`.
`ObjectWrappingMap` and `PartitionedMap` declared `keys()`, `values()` and `entries()` as
`IterableIterator`, but the TypeScript >= 5.6 `Map` declares `MapIterator`, so the classes
failed `implements Map` with six TS2416 errors. The return types now derive from `Map` itself
(`ReturnType<Map<K, V>['keys']>` and so on), like `[Symbol.iterator]` already did. Both classes
also add `getOrInsert` and `getOrInsertComputed` (the ESNext `Map` upsert methods), which a
consumer with `lib: ["ESNext"]` otherwise reports as missing (TS2420).
