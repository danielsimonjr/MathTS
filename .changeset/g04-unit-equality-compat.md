---
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-core': patch
---

**Unit equality and ordering (#1552):** Typed `unitsEqual` / `unitCmp` / `Unit.equals` compare absolute SI (including degC/degF offset) with `coreEqual` / typed value compare, not `===` or a number cast. Compat still copies mathjs 15.3.0 (`0 degC == 32 degF` is false) via factory adapters (`unit-relational.ts`); `min`/`max`/`sign` of Units use the same factories. Integral Fraction `format` uses an `n/1` suffix (`format-parity.ts`).
