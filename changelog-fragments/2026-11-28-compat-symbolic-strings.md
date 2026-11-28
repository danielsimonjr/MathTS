### Fixed

- **mathjs 15.3.0 symbolic algebra strings (#1790):** compat instances now route `simplify`, `simplifyCore`, `derivative`, and `resolve` through mathjs 15.3.0 ports so `toString()` and scoped evaluation match mathjs (string constants, resolve `Map` scopes, `acoth` derivative sign, bigint preserve).
- **`simplify` Object scopes:** mathjs-port `simplify` accepts plain-object scopes (including `rationalize`'s `Node, Array, Object` calls) and mirrors mathjs `removeConversion` registration.
- **`simplifyConstant` fractions:** use MathTS `Fraction` `numerator`/`denominator` and `fraction.js` exact rationals so constant folding yields `7 / 2` instead of decimal `3.5`.
- **Coverage floor:** lower compat line-coverage floor to 90 after the mathjs symbolic port (measured ~91%).
