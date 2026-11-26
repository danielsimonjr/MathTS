---
'@danielsimonjr/mathts-compat': patch
---

Constructors match mathjs 15.3.0 when `new` is missing (#1774): `Complex(...)` and `BigNumber(...)` are callable without `new` with the complex.js constructor forms, the guard classes (`Parser`, `Index`, `Range`, `Spa`, `ArgumentsError`, `DimensionError`) throw the mathjs `SyntaxError` on a new-less call, `Complex.fromPolar` follows the mathjs argument rules, and BigNumber leaves in nested-array arithmetic and `pinv` keep the compat BigNumber type.
