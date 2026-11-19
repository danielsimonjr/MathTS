---
'@danielsimonjr/mathts-functions': patch
---

`qr` returns `Q` and `R` with the entry type of the input: BigNumber for a BigNumber matrix, Complex for a matrix with a Complex entry. Before, the identity of `Q`, the zeros of `R` and the entries of a skipped Householder step stayed plain numbers. Fixes #1206.
