### Fixed

- **Error classes and message text match mathjs 15.3.0 (#1773):** compat instance functions now throw the same error types and wording as mathjs for null scalars, arity mismatches, invalid conversions, unit/valueless-unit cases, matrix `map` hints on unary math functions, spectral `norm` rules, `bitNot` integer messages, `random` BigNumber bounds, and invalid `numeric` strings.
