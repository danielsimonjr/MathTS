---
'@danielsimonjr/mathts-compat': patch
---

G07 `nullish` and logical Unit parity (#1555): `create(all)` binds factory `nullish`/`not`/`and`/`or`/`xor` (mathjs 15.3.0 semantics: Fraction preserved, element-wise nullish, Unit value truthiness, TypeError on plain objects). Native `functions` typed logical unchanged. Fraction `format` (`2/1`) remains G15 (#1721).
