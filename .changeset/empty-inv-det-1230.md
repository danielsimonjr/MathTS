---
'@danielsimonjr/mathts-functions': patch
---

`identity`, `inv` and `det` handle empty matrices (Refs #1230). The inverse of the 0 x 0 matrix is the 0 x 0 matrix, and its determinant is 1. This differs from mathjs 15.2.0, which throws for `identity(0)`.

- `identity(0)`, `identity(0, 0)`, `identity(0, 'dense')` and `identity(0, 'sparse')` return a 0 x 0 matrix. Before, they threw `Parameters in function identity must be positive integers`. The message now says "non-negative integers"; a negative or fractional size still throws. A size with one zero dimension (`identity(0, 3)`, `identity(3, 0)`) returns an empty matrix of that size; before, it threw the same error.
- `inv(matrix([]))`, `inv` of a 0 x 0 DenseMatrix and `inv(sparse([]))` return a 0 x 0 matrix of the same storage, as `lup(matrix([]))` does. `inv([])` returns `[]`. Before, `inv([])` and `inv(matrix([]))` threw `Matrix must be square (size: [0])`, and the 0 x 0 DenseMatrix and `sparse([])` threw the identity error.
- `det` of a 0 x 0 DenseMatrix or `sparse([])` returns `1`. Before, both threw `TypeError: Cannot read properties of undefined (reading '-1')`. `det([])` and `det(matrix([]))` still return `1`.
- `det([[]])` and `det(matrix([[]]))` (1 x 0) throw `RangeError: Matrix must be square`, and so does every Matrix with rows and no columns (`zeros(3, 0)`, dense or sparse). Before, they returned `1`.
- `inv` of a non-square empty input (`[[]]`, 1 x 0, 0 x 1) still throws `Matrix must be square`.
- `sqrtm` of a 0 x 0 matrix still throws. A DenseMatrix now gives `Cannot calculate max of an empty array` and `sparse([])` gives `Dimension mismatch (1 != 2)`; before, both gave the identity error. `pow(A, n)`, `expm` and `sylvester` of a 0 x 0 matrix are unchanged.
