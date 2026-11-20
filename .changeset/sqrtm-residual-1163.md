---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': patch
---

sqrtm of a singular matrix returns a real root when one exists. It no longer returns a value that is not a root (a residual of 0.458 for the matrix of the issue). matrixSqrtm reads a negative Schur entry within rounding noise as a zero eigenvalue. It returns the root when the root passes its check. A matrix with no real root still throws. For a singular matrix, the error message is now "iterative method could not converge" in place of "Cannot calculate inverse". (Refs #1163)
