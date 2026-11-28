### Fixed

- **mathjs 15.3.0 symbolic algebra strings (#1790):** compat instances now route `simplify`, `simplifyCore`, `derivative`, and `resolve` through mathjs 15.3.0 ports so `toString()` and scoped evaluation match mathjs (string constants, resolve `Map` scopes, `acoth` derivative sign, bigint preserve).
- **`simplify` Object scopes:** mathjs-port `simplify` accepts plain-object scopes (including `rationalize`'s `Node, Array, Object` calls) and mirrors mathjs `removeConversion` registration.
- **`simplifyConstant`:** stays on the MathTS factory (not duplicated in the mathjs port); `simplify` still folds constants through it so `3 + 2 / 4` simplifies to `7 / 2`.
