---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

A result matrix takes its size from the operands, not from its nested data. `multiply`, `add` and `subtract` of 0 x 0 matrices keep the size `[0, 0]`, `sparse(zeros(0, 3))` keeps the size 0 x 3, and compat `matrix(x, format)` keeps the size of a native matrix with a zero dimension. `freqz` throws a `RangeError` for a coefficient matrix that is not a vector. Compat `divide` of two native `DenseMatrix` operands gives a native `DenseMatrix`. (Refs #1337)
