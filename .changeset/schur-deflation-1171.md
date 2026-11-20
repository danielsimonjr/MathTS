---
'@danielsimonjr/mathts-matrix': patch
---

The Schur deflation test now also uses the superdiagonal entry (Ahues and Tisseur, LAPACK dlahqr). A 2x2 block with complex eigenvalues is no longer split. matrixSqrtm gives the correct root for such a block. matrixLogm now returns the real principal logarithm of a matrix with a complex-conjugate eigenvalue pair. It threw an error before. (Refs #1171)
