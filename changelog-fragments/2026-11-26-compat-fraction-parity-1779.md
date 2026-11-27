### Fixed

- **Fraction fraction.js parity (#1779):** The compat instance exposes the mathjs 15.3.0 `Fraction` type (fraction.js with `s`/`n`/`d`, decimal `toString()`/`valueOf()`, and string `toJSON`), routes `fraction()` through that type, and patches unit denormalization so `fraction(unit(...)).toNumeric(...)` matches the mathjs unit tests.
