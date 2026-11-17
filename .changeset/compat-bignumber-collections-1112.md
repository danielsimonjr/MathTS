---
'@danielsimonjr/mathts-compat': patch
---

`bignumber` converts an Array or a Matrix element by element, as mathjs does. Before, `bignumber([1, 2])` gave -Infinity, and null, a boolean, a bigint and a Fraction gave ±Infinity. A scalar call keeps the `BigNumber` return type. `bignumber()` still returns 0.
