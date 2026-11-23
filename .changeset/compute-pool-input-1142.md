---
'@danielsimonjr/mathts-parallel': patch
'@danielsimonjr/mathts-workerpool': minor
---

Each public data entry of `ComputePool` and `MathWorkerPool` converts an array-like argument to the array type that the entry reads, and throws a TypeError for any other value, before it picks the sequential or the parallel path. Before, `sum([1, 2, 3, 4], { forceParallel: true })` ended the Node process with an uncaught `DataCloneError`, a typed array of another element type gave wrong numbers, and `sum(1, { forceParallel: true })` gave 0. `map` and `filter` of a typed array now return a plain Array on every path. `parallelCount(1)` throws a TypeError. The workerpool package exports the guards `toFloat64Data`, `toInt32Data`, `toArrayData` and `assertArrayData`. (Refs #1142)
