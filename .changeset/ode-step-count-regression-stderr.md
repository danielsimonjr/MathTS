---
'@danielsimonjr/mathts-functions': patch
---

`solveODESystem` with a fixed `dt` now takes exactly n steps of `span/n`, ending on `tspan[1]`, when `span/dt` is within 4ε relative of a positive integer n; before, rounding such as `1e-3 / (1e-3/1000) = 1000.0000000000001` made `ceil` add a step and return 1002 states instead of 1001. A `span/dt` that is not near an integer still takes `ceil(span/dt)` steps, with bit-identical output.

`linearRegression` and `linregress` compute the slope standard error from the residuals, √(Σ(y − ŷ)² / ((n − 2)·Σ(x − x̄)²)), with core's pairwise sums; before, `syy − slope·sxy` cancelled on a near-exact fit and went negative when r rounded above 1, so `stdErr` was NaN. The behaviour for fewer than 3 points (a thrown error) is unchanged, and `ols` already used its residuals.
