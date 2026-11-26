### Fixed

- **`string()` with no arguments returns `''` (#1775):** the compat instance followed mathjs 15.3.0's typed `''` signature — calling `string()` no longer returns `'undefined'`, and `string(1, 2)` / `string(1, 2, 3)` now throw the mathjs `TypeError: Too many arguments in function string (expected: 1, actual: N)` instead of silently converting the first argument. All existing conversions (boolean, null, string, array/matrix element-wise, number, BigNumber, Complex, Unit, Fraction) are unchanged.
