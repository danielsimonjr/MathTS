---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` accepts opt-in `complexityWeights` (`ScalarComplexityWeights` from `@danielsimonjr/mathts-expression`). The hall of fame, the elitist-truncation complexity tie-break, and adaptive parsimony's complexity key all rank by `scalarComplexity(node, weights)`; omitted weights are `{}`, today's node count, so the seed-7 pin is unchanged. A non-finite weight throws `RangeError` before the first yield.
