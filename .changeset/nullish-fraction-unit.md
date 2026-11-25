---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

G07 (#1555): fix typed `nullish` (Fraction row, collection rows) and Unit truthiness on `not`/`and`/`or`/`xor`; compat `create(all)` keeps factory logical bindings for mathjs 15.3.0 (`nullish({}, 2)` throws). Fraction `format` (`2/1`) remains G15 (#1721).
