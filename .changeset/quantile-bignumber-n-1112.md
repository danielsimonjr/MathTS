---
'@danielsimonjr/mathts-functions': patch
---

quantileSeq with a BigNumber N returns the N evenly spaced quantiles as BigNumbers. It returned a BigNumber NaN, because bignumber() was applied to the whole result array (#1112).
