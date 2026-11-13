---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-statistics': patch
---

`cov` and `corrcoef` take `{ rowvar: true }` for the NumPy layout (variables as rows). The default stays observations as rows. `corrcoef([[1, 2, 3], [4, 5, 6]], { rowvar: true })` returns the 2×2 matrix of `np.corrcoef` (#896). Rows of unequal length throw a `RangeError` in both layouts, where they gave `NaN`.
