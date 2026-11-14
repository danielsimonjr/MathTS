---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

Brand-based type tests accept a value of a second copy of core (#1033). The typed `sum` keeps Complex, BigNumber and Fraction values exact, sums nested arrays and matrices in the pairwise kernel, and sums along a dimension (#1039). The typed `min` and `max`, and `mean`, `variance` and `std`, keep exact types; complex variance uses the conjugate. A 1-D sparse matrix is a column vector. New core exports: `pairwiseSumChecked` and `sumSquaredDeviationsChecked`.
