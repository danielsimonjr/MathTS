---
'@danielsimonjr/mathts-functions': patch
---

The factory functions accept the public `SparseMatrix` of `@danielsimonjr/mathts-matrix` (#949). A function that declares a matrix type converts a public (CSR) `SparseMatrix` argument to the compressed-column form on entry, and returns the public `SparseMatrix` when the result holds numbers. `dotDivide`, `dotMultiply`, `compare`, `equal`, `gcd`, `atan2`, `ceil`, `floor`, `dotPow`, `nthRoot` and about 100 other signatures no longer fail with `size is not a function`, `density is not a function` or `Cannot perform operation on Pattern Sparse Matrix and Scalar value`. A call that mixes a public `DenseMatrix` and a public `SparseMatrix` works. A result that holds booleans (`compare`, `equal`) stays a compressed-column sparse matrix, because the public class stores numbers only. A signature without sparse support throws an error that names `SparseMatrix` and `toDense()`. `divide(number, SparseMatrix)` reads the size from `rows` and `cols`.
