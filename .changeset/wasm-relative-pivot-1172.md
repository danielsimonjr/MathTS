---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-wasm': patch
---

The LU, inverse, determinant and QR of `WASMBackend` and the kernels `matrix_lu_decompose`, `matrix_inverse`, `matrix_determinant` and `matrix_qr_decompose` no longer compare a pivot to the absolute 1e-14. A pivot is now zero when it is at most 1e-14 times the sum of `|l|·|u|` of its own computation, so the verdict does not depend on the unit of the matrix. Before, a rank-deficient matrix times 2^20 was regular, `[[1, 0], [0, 1e-15]]` was singular, and `determinantWasm([[3e-100, 1e-100], [4e-100, 2e-100]])` returned 0 (it is 2e-200). The Householder QR skips a column only when its sub-column is exactly zero, and both QR kernels give an exact zero below the diagonal of R. (Refs #1172)
