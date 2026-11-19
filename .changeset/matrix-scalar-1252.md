---
'@danielsimonjr/mathts-functions': patch
---

`matrix` throws `TypeError` for input that is not matrix data, as mathjs does (Fixes #1252, Fixes #1272).

- A scalar (`matrix(5)`, `matrix(bignumber(5))`, `matrix(complex(1, 2))`) throws `Unexpected type of argument in function matrix`. Before, `matrix(5)` returned a dense matrix with no `_size`, so `qr`, `lup`, `eigs`, `schur`, `trace`, `lusolve`, `det`, `inv`, `sqrtm` and `expm` threw unrelated `TypeError`s such as `Cannot read properties of undefined (reading 'length')`.
- A storage object needs Array `data` and Array `size` on the dense path, or CSC `values`, `index`, `ptr` and `size` on the sparse path. Before, `matrix({ size: [2] })` built a matrix with `_data` undefined, `matrix({ data: 5, size: [1] })` kept `_data` 5, and a CSC object on the dense path built a dense matrix with no data. The `MathJSDenseMatrix` constructor checks the same rule.
- A format string other than `'dense'`, `'sparse'` or `'default'` throws `Unknown matrix type "<format>".`, and a boolean is read as a format string, as in mathjs (`matrix(false)` throws `Unknown matrix type "false".`).

Behaviour change: `matrix(0)`, `matrix(null)`, `matrix(false)` and `matrix('')` returned an empty matrix and now throw. That result was a silent coercion of an invalid argument. No non-breaking fix exists: any non-throwing result for these inputs keeps the coercion, and mathjs throws for each of them. `matrix()`, `matrix([])`, `matrix('dense')`, `matrix('sparse')`, array input and the internal `{ data, size }` and CSC storage objects are unchanged. The sparse-constructor scalar case of #1272 (`new MathJSSparseMatrix(5)`) is fixed by #1263.
