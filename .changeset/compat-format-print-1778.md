---
'@danielsimonjr/mathts-compat': patch
---

`format()` and `print()` honour mathjs 15.3.0 precision and template rules: engineering notation and fixed complexes no longer pick up implicit config precision, BigNumber default formatting still uses instance precision, and `print` handles Matrix scopes and arity like mathjs (#1778).
