---
'@danielsimonjr/mathts-matrix': patch
---

A matrix with an extreme entry no longer gives NaN, Infinity or a wrong result in `schur`, `qr`, `lq`, `rq`, `ql`, `qrPivoted`, `svd`, `singularValues`, `norm2`, `cond`, `pinv`, `lowRankApprox`, `sqrtm`, `logm`, `condest`, `lstsq` or the Frobenius norm (`normFro`, `DenseMatrix.norm`, `SparseMatrix.norm`) (Fixes #1104). `schur([[1, 1e160], [1e160, 1]])` returned a matrix of NaN; its diagonal is now 1e160 and -1e160, as in SciPy. The kernels square entries, so an entry above about 1e154 overflowed and an entry below about 1e-154 lost its digits. A matrix whose largest entry lies outside 2^±400 is now scaled by an exact power of 2 and the result is scaled back. A matrix inside that range takes the same path as before, with bit-identical results. `normFro`, `DenseMatrix.norm` and `SparseMatrix.norm` of `[[1e200, 1e200]]` return `1.414e200` instead of `Infinity`.
