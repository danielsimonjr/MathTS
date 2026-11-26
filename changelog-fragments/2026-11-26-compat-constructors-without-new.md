### Fixed

- **Constructors match mathjs 15.3.0 when `new` is missing (#1774):** the compat
  `Complex` and `BigNumber` are callable without `new` (`Complex(2, 3)` builds a
  Complex instead of throwing `Class constructor Complex cannot be invoked
without 'new'`), and the compat `Parser`, `Index`, `Range`, `Spa`,
  `ArgumentsError` and `DimensionError` throw the mathjs
  `SyntaxError('Constructor must be called with the new operator')` on a
  new-less call. The compat `Complex` constructor also takes every complex.js
  form — `(re, im)`, `{ re, im }`, `{ r, phi }`, `{ abs, arg }`, a two-element
  array and the complex.js string form, with `SyntaxError('Invalid Param')` for
  invalid input — and `Complex.fromPolar` follows the mathjs argument rules
  (`{ r, phi }`, angle Units, the mathjs error messages). Arithmetic on nested
  arrays with BigNumber leaves keeps the scalar type instead of failing in the
  numeric matrix backend, and `pinv` of a BigNumber returns a compat BigNumber.
