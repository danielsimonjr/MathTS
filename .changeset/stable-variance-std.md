---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-parallel': minor
---

Fix `variance`/`std` accuracy — was ~10⁶× worse than NumPy on large-mean data

`variance` and `std` lost ~7 significant digits on data with a large mean: variance of 1e9-pedestal
samples came out at **~1e-7 relative error**, where `np.var` is ~1e-13 and the true value (exact
rationals) is representable. The deviations `xᵢ − x̄` are small but sit on a huge pedestal, so any
error in the mean rides straight into every squared deviation.

Root cause spanned every path: the public typed `variance`/`std` used **Welford's online algorithm**
(`m2OfArray`), which drifted here; the parallel path (`ComputePool.variance`) used a **naive mean +
uncorrected two-pass**; and the factory/`std` paths had naive **WASM** kernels (`statsVariance`/
`statsStd`) that were both less accurate and — being memory-bound reductions — not faster.

Fixed with a new `sumSquaredDeviations` primitive in `@danielsimonjr/mathts-core`: the **corrected
two-pass** — mean via pairwise summation, then `Σd² − (Σd)²/n`, where the correction term cancels the
residual mean-bias exactly. Wired into every path (typed `variance`/`std`, `ComputePool.variance`,
the factory `variance`, and `std = sqrt(variance)`); the naive WASM fast paths are retired. Now
**machine-precision (relErr ~0), beating NumPy's uncorrected two-pass** — verified against exact
rationals and live NumPy. Everything built on variance (`std`, `zscore`, `parallelStatCorr`, …)
inherits the fix.
