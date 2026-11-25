---
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-functions': patch
---

`MathJSSparseMatrix` construction paths (#1582) use `isStructuralZero` so BigNumber, Fraction, Complex and Unit zeros are not stored like mathjs 15.3.0; number storage keeps exact `=== 0` (tiny values such as 1e-100 stay stored). CSC sparse add/subtract/multiply with Unit operands route through factory matAlgo paths. Compat wraps the fixed native sparse class and matches mathjs on the G17 adversarial surface.
