---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-tensor': patch
'@danielsimonjr/mathts-autograd': patch
---

A matrix that is not square throws a `RangeError` at every site, as in mathjs. Before, the same rule threw a plain `Error` at some sites, so `expm` of an Array threw `Error` and `expm` of a matrix threw `RangeError`. Each message stays the same, and a `catch` of `Error` still catches the error. `pinv`, `re`, `im`, `arg` and `setDistinct` of a matrix give a matrix (they gave an Array); `pinv([])` is `[]`, and a 1-D matrix gives a 1-D result. (Refs #1264)
