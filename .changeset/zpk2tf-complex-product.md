---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

Match mathjs 15.3.0 `zpk2tf` for 2-D Matrix arguments: the polynomial product uses the complex.js `mul`/`add` semantics the oracle uses (a NaN part counts as infinite), so a non-scalar root yields `Infinity + Infinityi` coefficients instead of `NaN + NaNi`; 1-D results are unchanged (#1589).
