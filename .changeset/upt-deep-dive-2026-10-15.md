---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-core': patch
---

`symbolicEqual` simplifies with the default rules (it passed an empty rule array, so every pair compared false). `linearRegression.pValue` and `ols.pValues` are the two-sided Student-t tail computed directly as the regularized incomplete beta (`studentTTwoSidedP`; `2·(1 − studentTCDF)` rounded a steep slope's tail to 0). `ols` equilibrates the normal matrix by its diagonal before inverting, so an SI-scaled design is no longer refused as singular. `Fraction.fromNumber` returns the last continued-fraction convergent at or below `maxDenominator` (it once returned 739/200 for a cap of 64). Found by the Universal-Physics-Tensor deep dive of 2026-10-15.
