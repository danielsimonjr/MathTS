---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-statistics': patch
'@danielsimonjr/mathts-signal': patch
---

Factory `median`, `mode` and `mad`, and `parallelFFT`, declare real return types in the published `.d.ts`. A strict consumer no longer needs a cast on their result.
