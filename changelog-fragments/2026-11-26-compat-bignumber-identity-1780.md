### Fixed

- **Unified compat BigNumber class (#1780):** `math.bignumber()`, `new math.BigNumber()`, and every compat function that returns a BigNumber now yield the same `CompatBigNumber` class. `valueOf()` returns the decimal string (mathjs 15.3.0 / decimal.js semantics), matrix and array results are deep-mapped, and instance function wrappers normalize native `BigNumber` results at the compat boundary.
