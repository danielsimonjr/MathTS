---
'@danielsimonjr/mathts-functions': patch
---

`sparse`, `matrix(data, 'sparse')` and the sparse matrix constructor throw `RangeError: Matrix must be two dimensional (size: [...])` for an input with three or more axes, or with no axis, instead of building an invalid matrix (Fixes #1263). Before, on main:

- `sparse([[[1],[2]],[[3],[4]]])` and `matrix(a3, 'sparse')` built a 2 x 2 matrix with array entries, and `lusolve` of it threw a `TypeError` from `equalScalar`. mathjs 15.2.0 gives the same `TypeError`.
- `sparse({ data: a3 })` built the same invalid matrix.
- `sparse(5)` returned an empty 0 x 0 matrix.
- `sparse(denseMatrix)` of any dense matrix, 2-D or 3-D, threw `TypeError: this._size is not iterable`. A 1-D or 2-D dense matrix and a sparse matrix are now accepted, as in mathjs.
- The sparse matrix constructor accepted a plain object with dense-matrix fields, such as `{ _data: [[1]], _size: [1, 1] }`. It now throws `TypeError: Unsupported type of data (Object)`, as mathjs does.

A 1-D array and a 1-D dense matrix keep their n x 1 column form. An empty 2-D input and every 2-D array build the same matrix as before.
