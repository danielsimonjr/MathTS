---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

`matrix(undefined)` throws a `TypeError`, as in mathjs, and `matrix(undefined, 'sparse')` does too. Before, an explicit `undefined` data argument gave an empty matrix. A call with no argument, `matrix()`, is still an empty dense matrix, and `matrix(data, undefined)` is still read as no format. (Fixes #1284)
