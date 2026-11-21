---
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-matrix': patch
---

Safe evaluate returns a matrix of the matrix package. Before, it refused the matrix as a host object, so `inv(A)`, `pinv(A)` and `transpose(A)` threw for a DenseMatrix or SparseMatrix `A` in scope. Inside such a matrix, safe evaluate accepts a typed array only as a plain numeric buffer: a real Float64Array, Float32Array or Int32Array with the exact prototype of its kind and no own property other than its indices. A typed-array subclass now throws at every position, as a result and as the receiver of a method call. Core exports the matrix brand `NATIVE_MATRIX_BRAND` from `/internal`, and the matrix classes and the guard read this one definition. (Refs #1036)
