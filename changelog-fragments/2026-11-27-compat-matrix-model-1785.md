### Fixed

- **Compat matrix model matches mathjs 15.3.0 (#1785):** `DenseMatrix`, `ImmutableDenseMatrix`, and `SparseMatrix` on `create(all)` use compat-only prototype wrappers (constructors without `new`, deep `clone`, `transpose` datatype, sparse CSC growth/`get`/`set`/`toJSON`/`fromJSON`/`Symbol.iterator`, Fraction/BigNumber datatypes). Jagged nested-array operands for `add`/`subtract`/`gcd` stay on the factory path instead of coercing to rectangular `DenseMatrix`.
- **Matrix factory promotion (#1785):** `matrix`/`sparse`/`transpose`/`clone` re-wrap bridge matrices with compat prototypes; `Index` dimensions use compat `ImmutableDenseMatrix`; `gcd` uses the mathjs-shaped factory; logical `or`/`xor` use bridge `DenseMatrix`/`SparseMatrix`; `max`/`min`/`sum` return scalars for 1-D matrices along dimension 0.
- **`DenseMatrix#create` scalars (#1785):** compat dense `create` returns a scalar unchanged (mathjs `reduce` parity) instead of wrapping numbers as matrices.
- **Immutable / sparse subset guards (#1785):** `ImmutableDenseMatrix` inherits immutable `min`/`max` and mathjs-shaped get/subset errors; sparse pattern `subset` and scalar-replacement checks match mathjs messages.
- **`matrix`/`sparse` factory routing (#1785):** compat overloads (`matrix('dense','number')`, identity clone) and arity rejections align with mathjs 15.3.0.
