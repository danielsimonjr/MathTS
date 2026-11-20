---
'@danielsimonjr/mathts-functions': patch
---

`eigs` of a Matrix of numbers uses the native solver, as the Array input does. Before, it used the general real-arithmetic solver, which threw "failed to converge" for some matrices and returned wrong eigenvectors. The result keeps the value order of a Matrix result and honours `matricize: false`. (Refs #1179)
