---
'@danielsimonjr/mathts-functions': patch
---

`qr` throws `RangeError('Matrix must be two dimensional (size: ...)')` for an input with more than two dimensions, as `lup` does (Fixes #1217). The size check now runs before the empty-input branch of `_denseQR`, which read only the first two sizes. Prior results: `qr([[[]]])` returned `Q = [[1]]` and `R = [[[]]]`; `qr([[[]], [[]]])` returned the 2 x 2 identity `Q` and `R = [[[]], [[]]]`; `qr(matrix([[[]]]))` returned a 1 x 1 `Q` and an `R` of size `[1, 1, 0]`. A non-empty 3-D Array or DenseMatrix threw an internal `TypeError` from `multiplyScalar`. Two dimensional empty inputs (`[]`, `[[]]`, `zeros(3, 0)`, `zeros(0, 3)`, `sparse([[]])`) keep their #1205 results.
