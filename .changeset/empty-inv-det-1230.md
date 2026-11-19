---
'@danielsimonjr/mathts-functions': patch
---

`identity`, `inv` and `det` handle empty matrices (Refs #1230). The inverse of the 0 x 0 matrix is the 0 x 0 matrix, and its determinant is 1. This differs from mathjs 15.2.0, which throws for `identity(0)`.

- `identity(0)`, `identity(0, 0)`, `identity(0, 'dense')` and `identity(0, 'sparse')` return a 0 x 0 matrix. Before, they threw `Parameters in function identity must be positive integers`. The message now says "non-negative integers"; a negative or fractional size still throws.
- `inv(matrix([]))`, `inv` of a 0 x 0 DenseMatrix and `inv(sparse([]))` return the empty matrix of the same kind. `inv([])` returns `[]`. Before, `inv([])` and `inv(matrix([]))` threw `Matrix must be square (size: [0])`, and the 0 x 0 DenseMatrix and `sparse([])` threw the identity error.
- `det` of a 0 x 0 DenseMatrix or `sparse([])` returns `1`. Before, both threw `TypeError: Cannot read properties of undefined (reading '-1')`. `det([])` and `det(matrix([]))` still return `1`.
- `det([[]])` and `det(matrix([[]]))` (1 x 0) throw `RangeError: Matrix must be square`. Before, they returned `1`.
- `inv` of a non-square empty input (`[[]]`, 1 x 0, 0 x 1) still throws `Matrix must be square`.
- `pow(A, n)` and `sqrtm` of a 0 x 0 matrix call `identity(0)`, which no longer throws.
