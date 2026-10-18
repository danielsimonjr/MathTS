---
'@danielsimonjr/mathts-functions': patch
---

`subtract` accepts plain arrays, Dense matrices and Sparse matrices element-wise, with scalar broadcast in both orders, as `add` does. Before this change `subtract([1, 2, 3], [1, 1, 1])` threw an unexpected-type error.
