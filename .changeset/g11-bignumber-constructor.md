---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-numbers': patch
---

`new BigNumber(x)` and `BigNumber.from(x)` now construct working instances (fixes runtime/type mismatch from a private constructor erased in JS). Export `bignumber` from core and `@danielsimonjr/mathts-numbers`. A second constructor argument throws; `new BigNumber(existing)` copies and `BigNumber.from(existing)` keeps the same instance. Internal values use a private token so `new BigNumber(1, 2)` cannot set the coefficient.
