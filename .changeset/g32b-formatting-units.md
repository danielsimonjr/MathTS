---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

Fraction `toString` uses decimal form when the denominator is a power of ten (`0.1`), and `toJSON` emits numeric `n` and `d` when they are safe integers. `size` returns a Matrix when `config.matrix` is `Matrix`, including for native dense matrices, and that matrix stringifies as `[2, 3]`. `createUnit` replaces an existing unit only when `{ override: true }` is passed. Unit conversions keep exact rational scales, so `1 L` is `1000 mL`.
