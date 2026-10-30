---
'@danielsimonjr/mathts-functions': minor
---

Add M12 scalar mutation and crossover operators (`weightedMutation`, PySR default weights, and grammar-checked tree variation). Every operator reaches nodes below a unary call, keeps natural `log` as `log`, and returns `null` instead of a tree that the grammar rejects. The do-nothing operator is exported as `identityMutation`, so the package's matrix `identity` export is unchanged.
