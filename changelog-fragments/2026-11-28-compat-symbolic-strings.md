### Fixed

- **mathjs 15.3.0 symbolic algebra strings (#1790):** compat instances now route `simplify`, `simplifyCore`, `derivative`, and `resolve` through mathjs 15.3.0 ports so `toString()` and scoped evaluation match mathjs (string constants, resolve `Map` scopes, `acoth` derivative sign, bigint preserve).