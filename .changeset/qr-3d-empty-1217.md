---
'@danielsimonjr/mathts-functions': patch
---

`qr` throws `RangeError('Matrix must be two dimensional (size: ...)')` for an input that is not two dimensional, as `lup` does (Fixes #1217, Fixes #1251). The size check now runs before the empty-input branch of `_denseQR`, which read only the first two sizes. Prior results: `qr([[[]]])` returned `Q = [[1]]` and `R = [[[]]]`; `qr([[[]], [[]]])` returned the 2 x 2 identity `Q` and `R = [[[]], [[]]]`; `qr(matrix([[[]]]))` returned a 1 x 1 `Q` and an `R` of size `[1, 1, 0]`. A non-empty 3-D Array or DenseMatrix threw an internal `TypeError` from `multiplyScalar`. A non-empty 1-D input (`qr([1, 2])`, `qr(matrix([1, 2]))`) threw `TypeError: row.some is not a function`. The empty vector (`[]`, `matrix([])`) and the two dimensional empty inputs (`[[]]`, `zeros(3, 0)`, `zeros(0, 3)`, `sparse([[]])`) keep their #1205 results.
