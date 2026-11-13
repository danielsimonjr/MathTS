---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-statistics': patch
'@danielsimonjr/mathts-signal': patch
---

Factory `median`, `mode` and `mad`, and `parallelFFT`, declare real return types in the published `.d.ts`. A strict consumer no longer needs a cast on their result. `median` and `mad` of a vector, a 2-D array, a `Float64Array` or a `Matrix` return `number`, and `mode` returns `number[] | number` (`NaN` for an empty input). `parallelFFT` accepts a `readonly number[]` or a `Float64Array` only: a call with a 2-D array, a `Matrix` or a `Float32Array` is now a compile error, because it gave NaN or threw at run time. The release notes of `mathts-statistics@0.4.15` and `mathts-functions@0.85.0` said that an empty `mode` returns `[]`; it returns `NaN`.
