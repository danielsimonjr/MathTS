---
'@danielsimonjr/mathts-compat': patch
---

Compat layer: `isPositive`, `isNegative`, `isInteger`, and `fix` on Fraction values use the MathTS `Fraction` API; `pow` with Fraction operands matches mathjs 15.3.0 exact roots and `predictable` throws; `Unit.typeConverters.BigNumber` converts Fraction magnitudes; `format` prints whole fractions as `n/1` (#1551).
