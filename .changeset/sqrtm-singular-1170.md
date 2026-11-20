---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': patch
---

sqrtm of a singular matrix that has a real root (the zero matrix, a rank-1 matrix) returns the root. Before, it threw "Cannot calculate inverse, determinant is zero". When Denman-Beavers does not give a root, sqrtm now uses the Schur method of matrixSqrtm. matrixSqrtm of a singular symmetric matrix now returns a root that squares back to the matrix to 1e-12. Before, the root of a matrix of rank below n-1 missed the matrix by 1e-9, and sqrtm threw an error. (Refs #1170)
