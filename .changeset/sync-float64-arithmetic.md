---
'@danielsimonjr/mathts-functions': minor
---

The `Float64Array` signatures of the arithmetic functions are now synchronous (#384). `add`, `subtract`, `multiply` (pair, `Float64Array * number`, `number * Float64Array`), `divide`, `unaryMinus`, `abs`, `sign`, `sqrt`, `square`, `cube`, `cbrt`, `exp`, `log`, `log10`, `log2`, `log1p`, `expm1`, `round`, `floor`, `ceil`, `fix`, `sinh`, `cosh` and `tanh` return a `Float64Array` instead of a `Promise<Float64Array>`. `norm`, `min`, `max` and `dot` return a number instead of a `Promise<number>`. `await` on the result still works, but `.then` on the result does not.

The binary ops throw `RangeError: Dimension mismatch (m != n) in element-wise operation` when the lengths differ. Before, the worker pool rejected the Promise. Variadic `add(a, b, c)` on `Float64Array` now works.

Fourteen of these ops (`sign`, `cube`, `cbrt`, `log10`, `log2`, `log1p`, `expm1`, `round`, `floor`, `ceil`, `fix`, `sinh`, `cosh`, `tanh`) sent arrays of 50,000 elements or more to worker threads. Measured with `tools/benchmarks/sync-unary-kernels.mjs` (medians of 9, at 5e4 / 5e5 / 5e6 elements): workers lose or tie on 9 of them (0.19x to 0.99x; `cosh` gave 1.25x at 5e5 in one of two runs). Workers win on the JS path of `log2` (1.56x to 2.01x), `expm1` (1.56x to 2.03x), `log1p` (1.15x to 1.61x), `sinh` (1.27x to 1.47x) and `tanh` (1.05x to 1.40x). For those, call `computePool.applyKernel` or `parallelMap` from `@danielsimonjr/mathts-parallel` on large arrays.
