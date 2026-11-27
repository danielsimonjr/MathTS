---
'@danielsimonjr/mathts-compat': patch
---

Unify compat BigNumber identity with mathjs 15.3.0 (#1780): every `bignumber()` / factory result uses `CompatBigNumber`, `valueOf()` returns the decimal string, and instance wrappers deep-map native `BigNumber` results in matrices and arrays.
