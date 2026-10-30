---
'@danielsimonjr/mathts-functions': patch
---

Phase 6 P6-2: consolidate the factory `xgcd` BigNumber and Fraction paths into one `_xgcdRing` loop over a small adapter (clone reduction).

This is not a pure refactor for BigNumber. The old `_xgcdBigNumber` called decimal.js method names (`isInt`, `lt`, `neg`, `minus`) that `@danielsimonjr/mathts-core`'s `BigNumber` does not define, so `factory_xgcd` on two core BigNumbers threw `a.isInt is not a function`. The adapter uses core's names (`isInteger`, `lessThan`, `negate`, `subtract`), so that path now returns `[gcd, x, y]`. The Fraction path and the number path return what they returned before.
