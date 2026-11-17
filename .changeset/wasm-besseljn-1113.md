---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-wasm': patch
---

The WASM Bessel kernels use the same limits and early exits as the JS path (Fixes #1113). `bessel_jn_f64` has the zero bound, the power-of-2 rescale and the downward-sweep limit of `besselJ`. `bessel_jn_f64` and `bessel_yn_f64` stop at the first NaN. `besselJ` and `besselY` on a `Float64Array` send only an integer order in the kernel range to the kernel. Every other order stays on the JS path, which returns the JS value or throws the JS `RangeError`. Before, an order above 2147483647 wrapped to another order. Where |x| ≤ |n| the kernel result is bit-identical to the JS result. Where |x| > |n| it agrees to 1e-11 relative, because the J0 and J1 kernels differ from JS by up to 2 ulp. The raw WASM exports `chebyshevT`, `hermiteH`, `laguerreL` and `legendreP` return NaN for a non-finite order, stop at the first NaN, and abort with an `Error` above 2147483646 (`laguerreL`: 1000000000). Before, they looped without end at 2147483647.
