---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-numbers': patch
---

`new BigNumber(x)` and `BigNumber.from(x)` now construct working instances (fixes runtime/type mismatch from a private constructor erased in JS). Export `bignumber` from core and `@danielsimonjr/mathts-numbers`.
