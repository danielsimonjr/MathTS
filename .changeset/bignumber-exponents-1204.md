---
'@danielsimonjr/mathts-core': minor
---

`BigNumber` enforces `minExponent` / `maxExponent`, no longer writes huge exponents as zeros, and adds every exponent exactly (Fixes #1204).

- `valueOf()` builds no zeros. `BigNumber.parse('1e100000000').valueOf()` is `Infinity` (it built a 100 MB string before), and `1e-100000000` gives `0`.
- `toString()` writes exponential notation when the order is at or above `toExpPos` or at or below `toExpNeg`: `BigNumber.parse('1e100000000').toString()` is `'1e+100000000'` (it was a string of 100000001 characters, and `1e9000000000000000` threw out of memory). `toExpPos` and `toExpNeg` are new `BigNumberConfig` fields with the defaults `1e6` and `-1e6`, so a value below 1 MB of text keeps its fixed-point output (`1e25` is still `'10000000000000000000000000'`). decimal.js uses 21 and -7; those defaults would change the output of existing tests. `toFixed()` still writes fixed-point notation.
- `minExponent` and `maxExponent` (default -1e9 and 1e9) were never read. A result or parsed value whose order is above `maxExponent` is now `Infinity` or `-Infinity`, and one below `minExponent` is `0`, as in decimal.js. `BigNumber.config()` throws `RangeError` for a bound that is not an integer from -1e15 to 0 (`minExponent`, `toExpNeg`) or from 0 to 1e15 (`maxExponent`, `toExpPos`). With these bounds every exponent sum is below 2^53 and exact: `3e4503599627370497` is `Infinity`, and its cube and cube root are `Infinity` (the cube root of the cube was `6.46...e+4503599627370497`).

BREAKING: a value with an order above 1e9 (for example `BigNumber.parse('1e2000000000')`, accepted before) is `Infinity`, and one below -1e9 is `0`. Set `BigNumber.config({ maxExponent: 1e15, minExponent: -1e15 })` to restore the range up to the bound. `parse` still throws `RangeError` for an exponent text above 2^53 - 1.
