---
'@danielsimonjr/mathts-core': patch
---

`BigNumber.toBigInt()` multiplies the coefficient by `10n ** exponent` and no longer builds a zero-padded string (#1245). A value with more than 1,000,000 digits throws a `RangeError` at once. Before, `1e2000000` returned a value after about 1 s, `1e5000000` after about 14 s, and `1e100000000` did not finish. NaN and Infinity still throw `Cannot convert NaN or Infinity to bigint`. Every value up to 1,000,000 digits gives the same result as before (seeded sweep of 2009 values, including negative, fractional and zero values).
