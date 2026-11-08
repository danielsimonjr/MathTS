---
'@danielsimonjr/mathts-functions': patch
---

`kruskalWallis`, `jarqueBera`, `chi2Contingency`, `cochranQ`, `moodMedianTest`, `powerDivergence`, `gTest` and `ljungBox` take their p-value from `chiSquaredSF`, and `fTest` takes its upper tail from `fSF`. A p-value below about 1e-16 was 0 and is now the scipy value.
