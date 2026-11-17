---
'@danielsimonjr/mathts-compat': patch
---

`bignumber` converts an Array or a Matrix element by element, as mathjs does. Before, `bignumber([1, 2])` gave -Infinity. `bignumber()` still returns 0.
