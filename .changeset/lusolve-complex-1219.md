---
'@danielsimonjr/mathts-functions': patch
---

`lusolve` keeps Complex, BigNumber and Fraction entries of an Array `A` or of `b`. The packed Float64 factorization read every entry as a number, so it dropped the imaginary part and the type. An entry that is not a number now takes the typed path, as a DenseMatrix or SparseMatrix `A` already did. A string entry is still read as a number, as in mathjs. Number input is unchanged (Fixes #1219).

Result before the fix:

- `lusolve([[i, 0], [0, 1]], [1, 1])` gave `[[1], [1]]`. It now gives `[[-i], [1]]`.
- `lusolve([[1, 2], [3, i]], [1, 2])` gave `[[0.6], [0.2]]`. It now gives a Complex solution with `A x = b`.
- `lusolve([[2, 1], [1, 3]], [complex(5, 1), 10])` gave `[[1.0594...], [2.9801...]]`. It now gives `[[1 + 0.6i], [3 - 0.2i]]`.
- BigNumber and Fraction entries in an Array `A` or `b` gave a number, such as `0.019999999999999997`. They now give BigNumber `0.02` and Fraction `6/35`.
- DenseMatrix `A`, SparseMatrix `A` (with and without order and threshold) and `lup` or `slu` factor objects already kept the Complex values.
