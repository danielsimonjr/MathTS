---
'@danielsimonjr/mathts-functions': patch
---

`lup` and `linsolve` use pivots that are relative to the matrix, so a regular matrix with entries near 1e-100 factors and solves. Before, on main:

- `lup([[3e-100, 1e-100], [4e-100, 2e-100]])` (an Array or a DenseMatrix) did not swap rows and did not divide, because every entry read as zero against the absolute tolerance of `larger` and `equalScalar`. It gave `L = [[1, 0], [4e-100, 1]]`. It now gives `L = [[1, 0], [0.75, 1]]` and `p = [1, 0]`, as SciPy does.
- `lup(sparse(...))` of the same matrix returned `L` equal to the identity and `U` with no entries. It now returns the same factors as the dense matrix. The sparse accumulator `Spa` drops an entry only when it is exactly zero. An entry that is not a number (BigNumber, Fraction, Complex) keeps the tolerance rule.
- `linsolve` threw `linsolve: singular matrix` for the same matrix. Its pivot test is now relative to the largest term that the elimination subtracted from the pivot entry, with the floor `8 * n * eps`. The solution is `[0, 1]`.
- `lsolve`, `usolve` and `lusolve` read a right-hand side near 1e-15 and below as zero. `lusolve(matrix([[2, 1], [1, 3]]), [[1e-16], [2e-16]])` returned `[[0], [0]]`. It now returns `[[2e-17], [6e-17]]`, for a DenseMatrix, a SparseMatrix and a factorization from `lup` or `slu`. A zero right-hand side entry is skipped only when it is exactly 0.
- The pivot search of `slu` tied every candidate of a matrix near 1e-100. `slu(sparse([[1e-110, 1e-100], [1e-100, 1e-100]]), 1, 1)` took the first row as the pivot and gave a multiplier of 1e10. It now takes the largest entry.
- `lsolve` threw `Linear system cannot be solved since matrix is singular` for the regular matrix `[[2e-100, 0], [1e-100, 3e-100]]`, and `lsolveAll` and `usolveAll` returned `[]` (no solution) for it and for `[[2e-100, 1e-100], [0, 3e-100]]`. A diagonal entry that is a number is now zero only when it is exactly 0, as in `usolve`. `lsolve` of the first matrix with `[[1], [2]]` returns `[[5e99], [5e99]]`. `lsolve([[1e-16, 0], [1, 1e-16]], [1e-16, 2])` threw and now returns `[[1], [1e16]]`.

The diagonal matrix `[[1e10, 0], [0, 1e-7]]` still solves, and `[[1, 2], [2, 4]]` and `[[1, 2], [2, 4 + 1e-15]]` still throw. A pivot that no term cancelled is valid at any size: `linsolve([[1e-16, 1], [0, 1]], [1, 1])` threw and now returns `[0, 1]`. A pivot below `8 * n * eps` times the terms that cancelled in it throws, so some rank-deficient matrices that returned an answer near 1e16 now throw, and a system with a condition number near 1e13 or above can throw. A result that `linsolve` or `leastSquares` returns is the same as before. (Refs #1169)
