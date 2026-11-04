---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` accepts an opt-in `fit` object (`restarts`, `maxIterations`, `bounds`, `algorithm`, `initial`) forwarded to `fitScalarParameters`. Omitted fields are today's refit call (restarts 2, maxIterations 8, no bounds, the fitter's default algorithm, the inherited start vector), so the seed-7 pin is unchanged.
