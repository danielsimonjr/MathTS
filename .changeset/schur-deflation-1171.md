---
'@danielsimonjr/mathts-matrix': patch
---

The Schur deflation test now also uses the superdiagonal entry (Ahues and Tisseur, LAPACK dlahqr). A 2x2 block with complex eigenvalues is no longer split. matrixSqrtm gives the correct root for such a block. matrixLogm now returns the real principal logarithm of a matrix with a complex-conjugate eigenvalue pair. It threw an error before. The Padé step of matrixLogm now makes one elimination for each quadrature node, not one for each column: a matrix of size 100 takes 0.3 s, where it took 13 s. The results are identical. A block with a very large ratio of its two off-diagonal entries no longer gives a NaN matrix or an error. (Refs #1171)
