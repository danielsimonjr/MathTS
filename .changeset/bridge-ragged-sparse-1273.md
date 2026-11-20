---
'@danielsimonjr/mathts-functions': patch
---

`sparse([[1], [2, 3]])` and `matrix(data, 'sparse')` of a ragged array keep every entry. The column count is the length of the longest row, as in mathjs. Before, the columns of a longer later row were lost. (Refs #1273)
