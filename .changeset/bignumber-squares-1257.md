---
'@danielsimonjr/mathts-functions': patch
---

The matrix 2-norm, `qr`, `std`, `corr` and the general `eigs` of BigNumber values no longer overflow or underflow in their squares (Fixes #1257). With `BigNumber.config({ precision: 20, minExponent: -300, maxExponent: 300 })`, the result before the fix was:

- `norm([[3e200, 0], [0, 4e200]], 2)` of BigNumbers returned `Infinity`. The result is now `4e+200`. The same matrix with `3e-200` and `4e-200` returned `0`. The result is now `4e-200`. The factory `norm` of number matrices had the same defect (`NaN` and `0`); the typed `norm` of numbers was already correct.
- `qr([[3e200, 1], [4e200, 1]])` of BigNumbers returned `NaN` entries in R (the Householder `alphaSquared` overflowed). R[0][0] is now `5e+200` and Q R equals A. `qr([[3e-200, 1], [4e-200, 1]])` returned the matrix itself as R (the squares of the first column underflowed, so the step was skipped). R[0][0] is now `5e-200`. The norm of each column is scaled by a power of 10 only when its squares can leave the configured exponent bounds, so every other result is unchanged. A number matrix already scaled by a power of 2.
- `std([1e200, 3e200])` of BigNumbers returned `Infinity`. The result is now `1.4142135623730950488e+200`. `std([1e-200, 3e-200])` returned `0`. The result is now `1.4142135623730950488e-200`. Numbers had the same defect (`Infinity` and `0`), and the result is now `1.414213562373095e+200` and `1.414213562373095e-200`. This holds for the typed `std`, the factory `std`, a normalization, `dim` and the options object. `variance` is unchanged: the variance of these values is out of range, and it stays `Infinity` or `0`.
- `corr` of BigNumber lists of order 1e200 or 1e-200 returned `NaN`; it is now the correlation (0.98198050606196571569 for `[1, 2, 4]` and `[1, 3, 5]`). `corr` of number lists of order 1e200 returned `NaN` as well.
- `eigs([[3e200, 1e200], [2e200, 4e200]])` of BigNumbers returned `NaN, NaN`. It is now `2e+200, 5e+200`. A complex pair is multiplied back as numbers.

Each function computes the plain result first and scales only when that result is `NaN`, infinite or 0 (`qr` and `eigs` scale when the squares of the largest entry can leave the exponent bounds). So the result of every input that was in range is unchanged: for numbers it is bit-identical, and for BigNumbers it is the same digits.

`hypot`, vector `norm` and `distance` are #1255. The scale helper `functions/src/utils/real-scale.ts` and the scaled sum of squares of #1255 (`BigNumber.hypotN`) should share one helper after both changes merge.
