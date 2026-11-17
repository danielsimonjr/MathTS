---
'@danielsimonjr/mathts-parallel': patch
---

`parallelEvery` and `parallelForEach` no longer throw `predicate is not defined` / `fn is not defined` on the worker path (Refs #1027). Before: both wrapped the callback in a closure, and the worker received only the closure source with a free variable, so any input at or above the parallel threshold threw. After: the wrapper embeds the source of the callback, as `parallelMap`, `parallelFilter`, `parallelFind`, `parallelSome`, `parallelCount`, `parallelSort` and `parallelReduce` already do. `parallelEvery(Array.from({length: 200000}, (_, i) => i), x => x >= 0)` now returns `true`.
