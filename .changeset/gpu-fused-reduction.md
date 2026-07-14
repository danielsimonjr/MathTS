---
'@danielsimonjr/mathts-functions': minor
---

Add `fuseUnaryChainReduceAsync(ops, xs, reduce)` — apply an element-wise chain and reduce
it **on the GPU**, returning a `number` instead of an array. `reduce` is
`'sum' | 'max' | 'min'`.

Reducing on the device sends `n/256` floats back across the bus instead of `n`. Measured
end-to-end for `sum(exp(sin(x)))` on an NVIDIA Pascal adapter: **1.35–1.7×** faster than
the existing GPU path followed by a JS loop, and **2.6–3.8×** faster than the CPU tier
(WASM chain + JS sum). At n=2²²: 260 ms → 100 ms → **72 ms**. The reproducible figure is the
**1.39× at n=2²²** (1.31–1.39× across four runs); the 1.7× upper bound comes from n=262,144,
where the ratio swings 1.19–2.83× run to run.

Opt-in via `enableGpu()` like every GPU path, so results carry f32 precision; with the
flag off it is an exact-f64 CPU computation. Reach for it only when you want _just the
scalar_ — if you also need the transformed array you pay the n-float readback anyway.

**A standalone GPU reduction is deliberately not offered:** an empty `ops` returns `null`.
Uploading n floats to produce one number is pure transfer tax and measured 3–9× slower
than a plain JS sum.

Also exported: `elementwiseChainReduceGpuDispatch`, `GPU_REDUCE_OPS`, `GpuReduceOp`.
