---
'@danielsimonjr/mathts-functions': patch
---

Sprint 2R (#423): `linregress` delegates slope inference to `linearRegression` (`studentTTwoSidedP`); far-tail p-values are tiny positives instead of flushed 0. `numericRealRoots` refines brackets with `findRoot` (Brent, tol 1e-14).
