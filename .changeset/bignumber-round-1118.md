---
'@danielsimonjr/mathts-core': patch
---

`BigNumber` `add`, `subtract` and `multiply` round the result to `config.precision` with the configured rounding mode, as decimal.js and mathjs do. Before, the square of a 64-digit value had 130 digits, and `add(bignumber('1'), bignumber('1e-30'))` at precision 20 gave `1.000000000000000000000000000001` (now `1`). A loop such as `solveODE` no longer grows without bound (29,005 digits after 24 steps). An integer `pow` runs its products with guard digits and rounds once. Constructors, `negate` and `abs` keep every digit. The release is a patch because the documented contract is `config.precision`. Results of more than `precision` digits were a defect, not a feature (Fixes #1118).
