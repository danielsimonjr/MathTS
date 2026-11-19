---
'@danielsimonjr/mathts-functions': patch
---

`qr` returns `Q` and `R` with one entry type, from the input. A matrix of numbers and BigNumbers gives BigNumber entries. A matrix with a Complex entry gives Complex entries; its number and BigNumber entries become Complex, as in `det`. Any other matrix keeps its entries as they are. Before, the identity of `Q`, the zeros of `R` and the entries of a skipped Householder step stayed plain numbers. For a matrix of numbers with one Complex entry, every product now uses Complex arithmetic, so the parts of `Q` and `R` can differ from the earlier result by a few units in the last place (at most 7.8e-16 absolute on the 8×8 test matrix). Fixes #1206.
