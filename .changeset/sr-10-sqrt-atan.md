---
'@danielsimonjr/mathts-expression': patch
---

The scalar subset gains two unary calls: `sqrt` and `atan`. `scalar.call('sqrt', x)` and `scalar.call('atan', x)` lower to themselves; a grammar may list either lowered name in `unary`. No other operator is added.

---

'@danielsimonjr/mathts-functions': patch
---

`evaluateScalar`, `compileScalar`, and `compileScalarGradient` support the scalar calls `sqrt` and `atan`, using the existing MathTS functions and the existing `DUAL_UNARY_RULES` derivative rules. The gradient batch uses the same primal row mask as `compileScalar`; non-finite partials become `NaN` in `grad` and do not drop rows from the fitter's loss. `scalar-node-bridge` lowered names are derived from `SCALAR_FUNCTION_LOWERING`. Dimension inference: `atan` joins the dimensionless-transcendental set; `sqrt` scales a dimensional argument by one half (the same scaling `^` applies at the literal exponent 0.5) and keeps a dimensionless argument dimensionless.
