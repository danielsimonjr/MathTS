---
'@danielsimonjr/mathts-core': patch
---

fix: `ObjectWrappingMap.entries()` and `PartitionedMap.entries()` (and `[Symbol.iterator]()`) now return real iterable iterators, so spread, `for...of` and `Array.from` over them no longer throw.
