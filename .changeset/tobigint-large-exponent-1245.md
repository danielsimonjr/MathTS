---
'@danielsimonjr/mathts-core': patch
---

`BigNumber.toBigInt()` multiplies the coefficient by `10n ** exponent` and no longer builds a zero-padded string (#1245). No value that the old conversion returned now throws. A value that is certainly above the V8 bigint limit of 2^30 bits (about 3.23e8 digits) throws a `RangeError` at once, for example `1e1000000000`. Before, that input did not finish. `1e2000000` now returns in about 0.5 s and `1e10000000` in about 3 s. NaN and Infinity still throw `Cannot convert NaN or Infinity to bigint`.
