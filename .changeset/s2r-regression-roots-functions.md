---
'@danielsimonjr/mathts-functions': patch
---

Sprint 2R (#423): `linregress` delegates slope inference to `linearRegression` (`studentTTwoSidedP`); far-tail p-values are tiny positives instead of flushed 0. Changed expectation: `upt-review-2-2026-10-15.test.ts` now asserts `linregress` on the steep near-exact line in (0, 1e-20), matching `I_{ν/(ν+t²)}(ν/2, 1/2)` (scipy.special.betainc / 2·t.sf / mpmath = 1.30816251668737e-32). `numericRealRoots` refines brackets with `findRoot` (Brent, tol 1e-14).
