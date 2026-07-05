---
'@danielsimonjr/mathts-functions': patch
---

Remove the runtime import cycle introduced with `typed/polynomial-ideal.ts`: `polyFromExpression` now uses a self-contained recursive-descent polynomial parser instead of importing the factory-scope `parse` (which closed the loop `factories/evaluate → typed/index → typed/algebra → polynomial-ideal → factories/evaluate`). Behavior is unchanged — all Gröbner/eliminate oracle pins pass identically; module cycles are back to 0.
