---
'@danielsimonjr/mathts-core': patch
---

BigNumber `add` and `subtract` no longer build `10^gap` for a large exponent gap, and `ln`, `log10`, `log` and a fractional `pow` no longer take time in proportion to the exponent. Before, `1e100000000 + 1` did not return and `1e2000000000 + 1` threw `RangeError`. `ln(1e100000)` took 12 to 15 seconds. Now each call returns in milliseconds, in every rounding mode, with the same digits as the exact sum. A fractional `pow` of a large argument keeps its last digits. An `add` or `multiply` of a wide operand that overflows gives `Infinity` and gave `0`. (Refs #1249)
