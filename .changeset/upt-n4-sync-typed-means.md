---
'@danielsimonjr/mathts-functions': minor
---

`sum`, `mean`, `variance` and `std` on `Float64Array` now return a number instead of a Promise, and `Float32Array` is accepted. `await` still works, but calling `.then` on the result does not. `parallelStat*` functions stay async.
