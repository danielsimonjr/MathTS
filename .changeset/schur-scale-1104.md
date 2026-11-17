---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

A matrix with a very large or very small largest entry is now scaled by an exact power of 2 in `schur`, `qr`, `lq`, `rq`, `ql`, `qrPivoted`, `svd`, `singularValues`, `norm2`, `cond`, `pinv`, `lowRankApprox`, `sqrtm`, `logm` and `condest`, and the result is scaled back (Fixes #1104). `schur([[1, 1e160], [1e160, 1]])` returned NaN; its diagonal is now 1e160 and -1e160 to 15 digits, as in SciPy.

Each routine has a window for the largest entry: 2^±128 for `schur`; 2^-400 to 2^128 for the `svd` family; 2^-20 to 2^128 for `logm`; 2^-20 to 2^400 for `qr`, `lq`, `rq`, `ql` and `sqrtm`; 2^±400 for `qrPivoted` and `condest`. A matrix inside its window takes the same path as before, with bit-identical results. One exception: `sqrtm` of a non-symmetric matrix with a largest entry above 2^256 now gets a scaled Schur step, which replaces a result that was wrong. A larger matrix is scaled to the top of the window. A smaller matrix is scaled to [1, 2).

`logm` of a matrix with a largest entry above 2^128 can change from the 12th digit. Inside the window the absolute cutoffs still apply: `sqrtm` treats a matrix as symmetric when its entries differ by at most 1e-8. When the entries span more than the double range, a value below about 2^-(1074 + hi) of the largest entry (hi is the top of the window) can become 0: `svd(diag(1e200, 1, 1e-200))` returns `[1e200, 1, 0]`. When the scale would lose a nonzero entry and the unscaled result is finite, the unscaled result is kept.

`normFro`, `DenseMatrix.norm`, `SparseMatrix.norm` and `norm(A, 'fro')` of `[[1e200, 1e200]]` return `1.414e200` instead of `Infinity`, and the norm of a matrix of 1e-200 entries is no longer 0. `lstsq` no longer overflows or underflows when the scale of `b` is subnormal or very large.
