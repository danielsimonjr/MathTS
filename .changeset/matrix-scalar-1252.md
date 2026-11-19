---
'@danielsimonjr/mathts-functions': minor
---

`matrix` throws `TypeError` for input that is not matrix data, as mathjs does (Fixes #1252, Fixes #1272).

- A scalar (`matrix(5)`, `matrix(bignumber(5))`, `matrix(complex(1, 2))`) throws `Unexpected type of argument in function matrix`. Before, `matrix(5)` returned a dense matrix with no `_size`, so `qr`, `lup`, `eigs`, `schur`, `trace`, `lusolve`, `det`, `inv`, `sqrtm` and `expm` threw unrelated `TypeError`s such as `Cannot read properties of undefined (reading 'length')`.
- A storage object needs Array `data` and Array `size` on the dense path. On the sparse path it needs Array `data` and `size`, or CSC `index`, `ptr` and `size` (the `values` can be null for a pattern matrix). Before, `matrix({ size: [2] })` built a matrix with `_data` undefined, `matrix({ data: 5, size: [1] })` kept `_data` 5, and a CSC object on the dense path built a dense matrix with no data. The `MathJSDenseMatrix` constructor checks the same rule.
- A format string as the first argument, other than `'dense'`, `'sparse'` or `'default'`, throws `Unknown matrix type "<format>".`. A boolean is read as a format string, as in mathjs (`matrix(false)` throws `Unknown matrix type "false".`).

BREAKING:

- `matrix(0)`, `matrix(NaN)`, `matrix(null)`, `matrix(false)`, `matrix('')` and `matrix('foo')` returned an empty dense matrix and now throw. `matrix(0, 'sparse')`, `matrix(null, 'sparse')` and `matrix(false, 'sparse')` returned an empty sparse matrix and now throw. Use `matrix()` or `matrix('sparse')` for an empty matrix.
- The functions that pass a format to `matrix` throw `Unknown matrix type` for an unknown format string. Before, they used the dense format: `zeros(2, 2, 'foo')`, `zeros('foo')`, `ones(2, 'foo')`, `identity('foo')`, `identity('')`, `rotationMatrix('foo')`, `rotationMatrix('')` and `matrixFromFunction([2, 2], 'foo', f)`.
- `matrix(0)` throws through `evaluate` and through the compat instance (`math.matrix(0)`) too. The compat `zeros`, `ones` and `identity` have their own code and are unchanged.

No non-breaking fix exists: any result that does not throw keeps the silent coercion of an invalid argument, and mathjs 15.2.0 throws for each of these calls. `matrix()`, `matrix([])`, `matrix('dense')`, `matrix('sparse')`, `matrix('default')`, array input, a Matrix and the internal `{ data, size }` and CSC storage objects are unchanged. A second argument that is not a known format (`matrix([[1]], 'foo')`) is still read as dense (#1284). The sparse-constructor scalar case of #1272 (`new MathJSSparseMatrix(5)`) is fixed by #1263.
