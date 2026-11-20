---
'@danielsimonjr/mathts-functions': patch
---

sqrtm of a singular matrix that has a real root (the zero matrix, a rank-1 matrix) returns the root. Before, it threw "Cannot calculate inverse, determinant is zero". When Denman-Beavers does not give a root, sqrtm now uses the Schur method of matrixSqrtm. (Refs #1170)
