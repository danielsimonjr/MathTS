---
'@danielsimonjr/mathts-expression': patch
---

Fix `scalarComplexity` reading inherited keys of the weight records: a symbol named `constructor` or `toString` returned a function weight and the sum became `NaN`. Weights are now read with the existing own-property helper, so an absent name weighs 1.
