---
'@danielsimonjr/mathts-functions': minor
---

Physics mode can bind bare `e` as the SI magnitude `1.602176634e-19` when `evaluate`, `compileExpr`, or `parser` is called with `{ physics: true, charge: 'scalar' }`, so `1 - e^2` is ordinary arithmetic. `{ physics: true }` still returns the coulomb Unit. `rationalNullspace` accepts `columns` for a matrix with no rows. `propagateUncertainty` accepts a function, with central differences and an optional curvature probe that is not folded into sigma. `gaussLegendre4` reports the Picard iteration count of each step.
