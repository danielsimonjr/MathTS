### Fixed

- **Compat matrix model matches mathjs 15.3.0 (#1785):** `DenseMatrix`, `ImmutableDenseMatrix`, and `SparseMatrix` on `create(all)` use compat-only prototype wrappers (constructors without `new`, deep `clone`, `transpose` datatype, sparse CSC growth/`get`/`set`/`toJSON`/`fromJSON`/`Symbol.iterator`, Fraction/BigNumber datatypes). Jagged nested-array operands for `add`/`subtract`/`gcd` stay on the factory path instead of coercing to rectangular `DenseMatrix`.
