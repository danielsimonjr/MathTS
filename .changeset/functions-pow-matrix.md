---
'@danielsimonjr/mathts-functions': minor
---

`pow(A, n)` now supports **square-matrix power** for non-negative integer exponents (mathjs parity) — previously `pow` had only scalar signatures and threw `Unexpected type of argument` on a matrix. It uses binary exponentiation on the native `DenseMatrix` backend (accelerated matmul, B2). Element-wise power remains `dotPow`; negative or fractional matrix powers throw a clear error directing to the async `matrixPower(A, p)` (which does the eigendecomposition).
