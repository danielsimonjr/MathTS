---
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-functions': patch
---

Sparse construction in `SparseMatrix` (#1582) replaces `!== 0` storage checks with `isStructuralZero`, so BigNumber, Fraction, and Unit zeros are omitted like mathjs 15.3.0 does (`sparse([[3, 0], [5, 0]]).density()` is `0.5` under `number: 'BigNumber'`, `unit(sparse(...))` drops zero cells). Number storage is unchanged: a number uses the exact `=== 0`, so tiny values such as 1e-100 stay stored. Sparse × Unit arithmetic drops the zero cells where mathjs 15.3.0 does.
