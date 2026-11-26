### Fixed

- **`Unit` `Numeric` is the live numeric classes (#1555):** `new Unit(bignumber, unit)` and `new Unit(fraction, unit)` type-check. The old `Numeric` union used duck types (`div`/`times` with a wide operand, Fraction `n`/`d`/`s`) that the live `BigNumber` and `Fraction` classes do not satisfy.

- **G07 typed logical truthiness is type-aware (#1555):** `isTruthy` used `!!x`, so a zero Unit/Fraction/Complex/BigNumber was truthy in mixed `any, any` and variadic rows, and `not(fraction)` converted through Complex. Truthiness now follows the stored numeric value (Fraction by numerator; Unit by `value`, including 0 degC). `nullish({}, 2)` still returns `{}` natively (a non-nullish left value); compat still throws like mathjs 15.3.0.

- **G07 typed logical bugs (#1555):** `nullish` lacked a `Fraction` row, so typed-function conversion treated a Fraction as Complex; it lacked collection rows, so `nullish` on arrays was not element-wise; `not`/`and`/`or`/`xor` treated every `Unit` as truthy because `!!unit` ignores the numeric value. Typed logical now adds `Fraction` and `Unit` nullish rows, spreads `collectionBinaryRows('nullish')`, registers `Unit` truthiness from `value`, and keeps `null`/`undefined` rows before `any, any`. `nullish({}, 2)` is not changed here (mathjs 15.3.0 throws; compat factory keeps that quirk).

- **G07 `nullish` and logical `Unit` compat parity (#1555):** `mathts-compat` `create(all)` binds factory `nullish`/`not`/`and`/`or`/`xor` for mathjs 15.3.0 (`nullish({}, 2)` throws). Fraction `format` (`2/1`) is G15 (#1721), not this change.
