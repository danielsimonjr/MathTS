---
'@danielsimonjr/mathts-expression': patch
---

The scalar subset gains two unary calls: `sqrt` and `atan`. `scalar.call('sqrt', x)` and `scalar.call('atan', x)` lower to themselves; a grammar may list either lowered name in `unary`. No other operator is added.

---

'@danielsimonjr/mathts-functions': patch
---

`evaluateScalar`, `compileScalar`, and `compileScalarGradient` support the scalar calls `sqrt` and `atan`, using the existing MathTS functions and the existing `DUAL_UNARY_RULES` derivative rules. Dimension inference: `atan` joins the dimensionless-transcendental set; `sqrt` scales a dimensional argument by one half (the same scaling `^` applies at the literal exponent 0.5) and keeps a dimensionless argument dimensionless.
