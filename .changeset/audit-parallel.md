---
'@danielsimonjr/mathts-parallel': minor
---

`forceParallel` and `forceSequential` are honored. The standalone `parallel*` functions used to accept them and ignore them; every `ComputePool` operation now takes a trailing `DispatchOptions` (new exported type) and the functions forward their options. `forceSequential` wins when both are set, and `forceParallel` on a pool that was never initialized runs inline.

`WorkerPool` isolates worker errors: only the tasks the crashed worker was running are rejected, the worker is terminated, evicted and replaced, and a healthy worker whose task is gone returns to the free list (it used to be stranded). Workers start concurrently, task ids are a counter, and `maxWorkers` must be a positive integer (`0`, negatives and fractions now throw a `RangeError` instead of falling back to the default).

Shapes are validated at every size: `ParallelMatrix.multiply` and `ComputePool.matmul` check inner dimensions and buffer lengths, `transpose` and `matvec` check them before choosing a path. `histogram` requires a positive integer `bins`, skips NaN and infinite samples and puts a constant array in bin 0. `tensordot` reads `subarray` operands correctly. `ParallelMatrix` keeps an input that is already `SharedArrayBuffer`-backed instead of copying it.

Length-mismatch errors share one shape, `<op>: lengths must match (<a> vs <b>)`; messages that tests or callers matched on (`Array lengths must match: ...`, `dot: vectors must have the same length`) changed.
