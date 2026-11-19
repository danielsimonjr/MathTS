---
'@danielsimonjr/mathts-functions': patch
---

`hypot`, `norm` (a vector 2-norm and `'fro'`) and `distance` of BigNumber values scale the values by a power of ten before they square them (Fixes #1255). The result is correct whenever it is in range, and the configured `minExponent` and `maxExponent` apply to the result only.

Result before the fix, for values of order 5e15 above the exponent limit of the squares:

- `hypot(3e5000000000000000, 4e5000000000000000)`, `norm([..])` and `norm([[..]], 'fro')` returned `Infinity`. The result is now `5e+5000000000000000`.
- `hypot(3e-5000000000000000, 4e-5000000000000000)` and the same `norm` returned `0`. The result is now `5e-5000000000000000`.
- With `config({ maxExponent: 100 })`, `hypot(3e60, 4e60)` returned `Infinity`. The result is now `5e+60`.
- The digits of ordinary values do not change (1000 random vectors at precision 64).
- Number input does not change.
