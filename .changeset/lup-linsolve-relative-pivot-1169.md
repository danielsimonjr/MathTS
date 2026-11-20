---
'@danielsimonjr/mathts-functions': patch
---

`lup` and `linsolve` use pivots that are relative to the matrix, so a regular matrix with entries near 1e-100 factors and solves. Before, on main:

- `lup([[3e-100, 1e-100], [4e-100, 2e-100]])` (an Array or a DenseMatrix) did not swap rows and did not divide, because every entry read as zero against the absolute tolerance of `larger` and `equalScalar`. It gave `L = [[1, 0], [4e-100, 1]]`. It now gives `L = [[1, 0], [0.75, 1]]` and `p = [1, 0]`, as SciPy does.
- `lup(sparse(...))` of the same matrix returned `L` equal to the identity and `U` with no entries. It now returns the same factors as the dense matrix. The sparse accumulator `Spa` drops an entry only when it is exactly zero. An entry that is not a number (BigNumber, Fraction, Complex) keeps the tolerance rule.
- `linsolve` threw `linsolve: singular matrix` for the same matrix. Its pivot test is now relative to the largest entry of the pivot row of the matrix. The solution is `[0, 1]`.

The diagonal matrix `[[1e10, 0], [0, 1e-7]]` still solves, and `[[1, 2], [2, 4]]` and `[[1, 2], [2, 4 + 1e-15]]` still throw. The only new throw, for a matrix with finite entries, is a pivot below 1e-15 of its own row. `linsolve` and `leastSquares` give the same result as before for every other matrix of finite entries. (Refs #1169)
