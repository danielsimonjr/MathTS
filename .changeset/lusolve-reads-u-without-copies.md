---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

`DenseMatrix.toArray()` copies each row straight from the storage. It no longer calls `get()` and its bounds check for every entry, and it honours the offset and the row stride of a view. `lusolve` on nested input reads the packed U factor with one `toFloat64Array()` copy. It no longer builds a nested copy of U, and it returns the n×1 column without a matrix wrapper.
