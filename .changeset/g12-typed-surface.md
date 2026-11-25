---
'@danielsimonjr/mathts-compat': minor
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-expression': minor
'@danielsimonjr/mathts-functions': minor
---

Typed-package surface exports and decisions (#1567–#1571): `core` exports canonical error classes and lowercase constant aliases; `functions` exports matrix helpers, `ArgumentsError`, and 63 `create*` factory aliases; `expression` exports `docs`, `ResultSet`, Node classes, and `Parser`. Compat adapters restore mathjs 15.3.0 broadcast errors, block `evaluate` `ResultSet` shapes, shared `DimensionError`, and the embedded-docs map. Native typed arithmetic is unchanged (`RangeError` on mismatched vectors). Expression `ResultSet`/parse identity fixes are native **good idea** changes for `instanceof` parity.
