---
'@danielsimonjr/mathts-functions': patch
---

Resizing a sparse matrix fills the new entries with the default value, leaves the input as it is when a copy is asked for, and needs a size with two dimensions. `ones(2, 3, 'sparse')` is a matrix of ones, as in mathjs; before, it was all zero. `resize(sparse, [3])` and `zeros(3, 'sparse')` throw `Only two dimensions matrix are supported`. (Refs #1279, #1288)
