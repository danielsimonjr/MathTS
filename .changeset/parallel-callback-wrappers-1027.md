---
'@danielsimonjr/mathts-parallel': patch
---

`parallelEvery` and `parallelForEach` no longer throw `predicate is not defined` / `fn is not defined` on the worker path (Refs #1027). Before: both wrapped the callback in a closure, and the worker received only the closure source with a free variable, so any input at or above the parallel threshold threw. After: the `toString()` of the wrapper gives self-contained source that embeds the source of the callback, so the worker path runs. The wrapper stays a closure, so the sequential path still accepts closures and bound or native functions. `parallelEvery(Array.from({length: 200000}, (_, i) => i), x => x >= 0)` now returns `true`.
