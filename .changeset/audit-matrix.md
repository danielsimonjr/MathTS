---
'@danielsimonjr/mathts-matrix': minor
---

Fix `DenseMatrix.diagonal(k)` length on non-square matrices (it now matches `SparseMatrix.diagonal`). `DenseMatrix` and `SparseMatrix` constructors reject non-integer dimensions, unsupported data types, out-of-range column indices and non-monotonic row pointers; `SparseMatrix.validate` runs the full CSR check. `SparseMatrix.fromCOO` bounds-checks indices and sums duplicate entries. `SparseMatrix.transpose` is a counting-sort CSR transpose. `DenseMatrix.toSparse` no longer relies on `require`. `JSBackend` element-wise, transpose, sum and dot kernels, the dense reductions and the `lu`, WASM and GPU result paths work on flat storage without per-element `get()` calls or extra copies.
