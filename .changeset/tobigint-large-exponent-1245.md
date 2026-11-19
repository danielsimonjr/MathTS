---
'@danielsimonjr/mathts-core': patch
---

`BigNumber.toBigInt()` multiplies or divides the coefficient by a power of ten and no longer builds and parses a zero-padded string (#1245). No value that the old conversion returned now throws, and every result is the same. Measured on Node 26: most values with an exponent between -2048 and 2048 are 4 to 40 times faster (`1e20`: 4.1 to 0.45 microseconds per call; a value below 1 or a 60-digit coefficient with 30 decimals takes the same time), `1e5000000` takes 1.5 s (before 2.6 s) and `1e100000000` takes 59 s (before 85 s). A value with 323231232 digits or more is certainly above the V8 bigint limit of 2^30 bits and throws a `RangeError` before any work, for example `1e1000000000`; the old conversion threw `RangeError: Invalid string length` for that input and a `SyntaxError` after seconds of work for `1e323000000`. NaN and Infinity still throw `Cannot convert NaN or Infinity to bigint`.
