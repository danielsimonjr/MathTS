---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

Brand-based type tests accept a value of a second copy of core (#1033). The typed `sum` keeps Complex, BigNumber and Fraction values exact, sums nested arrays and matrices in the pairwise kernel, and sums along a dimension (#1039). New core export: `pairwiseSumChecked`.
