---
'@danielsimonjr/mathts-core': patch
---

`BigNumber` enforces `minExponent` / `maxExponent`, no longer writes huge exponents as zeros, and overflows an exponent sum above 2^53 (Fixes #1204).

- `valueOf()` builds no zeros. `BigNumber.parse('1e100000000').valueOf()` is `Infinity`, as before, but it no longer builds a string of 100000001 characters first.
- `toString()` writes exponential notation when the order is at or above `toExpPos` or at or below `toExpNeg`. `BigNumber.parse('1e100000000').toString()` is `'1e+100000000'` (12 characters; it was 100000001 characters). `toExpPos` and `toExpNeg` are new `BigNumberConfig` fields with the defaults `1e6` and `-1e6`. A value with an order below 1e6 keeps its fixed-point output (`1e25` is still `'10000000000000000000000000'`). `toFixed()` still writes fixed-point notation.
- `minExponent` and `maxExponent` were never read. Their default is now -9.007e15 and 9.007e15 (it was -1e9 and 1e9, not enforced), just below 2^53 - 2^31, so every in-range exponent is an exact integer. A value whose order is above `maxExponent` is `Infinity` or `-Infinity`, and one below `minExponent` is `0`, as in decimal.js. A value with an order of 2e9 (`1e2000000000`) stays finite.
- An exponent sum above the bound overflows: `1e5000000000000000` squared is `Infinity` (it was `1e+10000000000000000`), and the cube of `3e4503599627370497` is `Infinity` (it was `2.7e+13510798882111492`, an exponent above 2^53 that was rounded).
- `BigNumber.config()` throws `RangeError` for a bound that is not an integer from -(2^53 - 2^31) to 0 (`minExponent`, `toExpNeg`) or from 0 to 2^53 - 2^31 = 9007197107257344 (`maxExponent`, `toExpPos`). The message names the limit. `parse` still throws `RangeError` for an exponent text above 2^53 - 1; a parsed order from 9.007e15 to 2^53 - 1 is now `Infinity` or `0`.
