---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

G07 (#1555): typed `nullish` keeps Fraction/Unit and is element-wise on collections; `not`/`and`/`or`/`xor` use numeric Unit/Fraction truthiness (not `!!object`). Compat `create(all)` binds mathjs factories (`nullish({}, 2)` TypeError). Native `nullish({}, 2)` still returns `{}`. Fraction `format` (`2/1`) remains G15 (#1721).
