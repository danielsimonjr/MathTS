---
'@danielsimonjr/mathts-functions': patch
---

Fix the edge inputs of the FFT family (Fixes #1010, Refs #1090).

- `fft([5])` returned the bare number `5`. It returns one Complex bin, `5 + 0i`, like longer inputs (also `ifft([5])`).
- `ifft(x, n)` threw `Too many arguments`. It takes `n` as NumPy does: the spectrum is cropped or zero-padded to `n` bins (`ifft([1,2,3,4], 2)` is `[1.5, -0.5]`; `n = 6` gives 6 bins). `n` must be a positive integer, and only a 1-D input is supported.
- `fft([NaN, 1, 2, 3])` gave NaN real parts but imaginary parts `0, 2, 0, -2`, while 64 or more values gave NaN in both parts. A NaN in either part of any input now makes every bin NaN in both parts, for every length. NumPy keeps the imaginary parts at small lengths, so this differs from NumPy there.
- `rfft(matrix)` threw `RangeError`, and `rfft([[...],[...]])` returned `undefined` rows. `rfft` takes a Matrix, a typed array and nested arrays, and transforms the last axis (`rfft([[1,2,3,4],[5,6,7,8]])` is `{ re: [[10,-2,-2],[26,-2,-2]], im: [[0,2,0],[0,2,0]] }`).
- `fftn([1,2,3,4])` and `fftn(matrix)` threw `TypeError`. `fftn` takes 1-D and N-D input and a Matrix, and returns plain arrays (`fftn([1,2,3,4])` equals `fft`).
- `periodogram([])` threw `RangeError`. It returns `{ psd: [], frequencies: [] }`, as SciPy does. `periodogram([5])` and `multiTaperPSD([5])` no longer build an array of fractional length.
- `fft2d([])` and `fft2d([[]])` keep their input shape instead of a padded 1x1 result.
