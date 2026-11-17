---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-wasm': patch
---

The WASM Bessel and recurrence kernels use the same order limits as the JS path (Fixes #1113). `bessel_jn_f64` has the zero bound, the power-of-2 rescale and the downward-sweep limit of `besselJ`, and `besselJ` and `besselY` on a `Float64Array` send an order to the kernel only when the kernel gives the JS result. A non-integer, non-finite or above-i32 order stays on the JS path, so it throws the same `RangeError` or returns the same value. Before, an order above 2147483647 wrapped to another order. `chebyshevT`, `hermiteH`, `laguerreL` and `legendreP` abort above their limit and stop at the first NaN, and no longer loop for 25 s or for ever.
