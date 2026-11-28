### Fixed

- **Compat matrix model (#1785):** `DenseMatrix`/`ImmutableDenseMatrix` `get` takes one array index; `subset` rejects a bad arity with `SyntaxError`; a `1×3×1` unsqueeze and an empty index match mathjs; `sparse(matrix)` clones CSC `_values`; `subtract(BigNumber, boolean)` stays a BigNumber.
