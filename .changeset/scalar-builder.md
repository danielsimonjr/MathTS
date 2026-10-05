---
'@danielsimonjr/mathts-expression': minor
'@danielsimonjr/mathts-functions': minor
---

Add a public scalar-expression builder. `@danielsimonjr/mathts-expression` exports `createScalarBuilder`, `SCALAR_FUNCTIONS`, and `SCALAR_FUNCTION_LOWERING`. `@danielsimonjr/mathts-functions` exports `scalar` and `evaluateScalar`. `ln` lowers to natural `log` and `log` lowers to `log10`. Nodes are built from a typed tree. A formula string is rejected.

Publish `@danielsimonjr/mathts-expression@0.10.0` before `@danielsimonjr/mathts-functions@0.68.0`. The functions package still depends on `@danielsimonjr/mathts-expression` `^0.9.0`, which also matches 0.9.0. Tighten that range to `^0.10.0` in the release so 0.68.0 cannot load an expression package that has no builder.
