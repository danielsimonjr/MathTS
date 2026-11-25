---
'@danielsimonjr/mathts-compat': minor
'@danielsimonjr/mathts-expression': minor
'@danielsimonjr/mathts-functions': minor
---

Compat `create(all)` follows the mathjs expression policy by default (#1549, #1556, #1562, #1576, #1580): `evaluate` / `compile` / `parser` allow assignment, function definitions, in-expression `simplify`/`derivative`/`parse`/`evaluate`/`compile`/`parser`/`help`/`config`, node methods, and `ResultSet` block results; functions defined in expressions carry their declared name. Pass `{ safe: true }` to opt back into the typed-API sandbox. The typed `evaluate` / `compileExpr` / `parser` stay safe by default and keep `{ unsafe: true }` as their opt-out. BREAKING: compat `evaluate`/`parser`/`compile` no longer throw `Security:` by default, and multi-statement blocks return a `ResultSet` on both compat and typed `evaluate`. `range` can no longer allocate without bound when the step direction is misread (a guard against the #1551 sign-test defect).
