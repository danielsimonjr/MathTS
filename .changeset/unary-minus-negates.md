---
'@danielsimonjr/mathts-functions': minor
---

`evaluateScalar`, `compileScalar` and `compileScalarGradient` read a one-argument `-` as negation, `(-1) * x`. Before, they returned the argument unchanged, so `-x` at x = 3 gave 3 and a gradient of 1. A one-argument `+ * /` still returns its argument. `scalarToNode` is unchanged: a one-argument `-` still maps to a one-argument `subtract`, which `Node.evaluate` refuses.
