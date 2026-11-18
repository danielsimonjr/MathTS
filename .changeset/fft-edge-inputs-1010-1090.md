---
'@danielsimonjr/mathts-functions': patch
---

Fix the edge inputs of the FFT family (Fixes #1010, Fixes #1090).

- `fft([5])` returned the bare number `5`. It returns one Complex bin, `5 + 0i`, like longer inputs (also `ifft([5])`). A one-element BigNumber, Fraction or numeric string input also gives a Complex bin. A one-element Unit stays a Unit.
- `ifft(x, n)` threw `Too many arguments`. It takes `n` as NumPy does: the spectrum is cropped or zero-padded to `n` bins (`ifft([1,2,3,4], 2)` is `[1.5, -0.5]`; `n = 6` gives 6 bins). `n` must be a positive integer, and only a 1-D input is supported.
- `fft([NaN, 1, 2, 3])` gave NaN real parts but imaginary parts `0, 2, 0, -2`, while 64 or more values gave NaN in both parts. A NaN in either part of any input (a number, a Complex or a BigNumber) now makes every bin NaN in both parts, for every length. NumPy keeps the imaginary parts at small lengths, so this differs from NumPy there. Infinity is outside this rule: the parts of a bin next to an infinite input are not specified.
- `rfft(matrix)` threw `RangeError`, and `rfft([[...],[...]])` returned `undefined` rows. `rfft` takes a Matrix, a typed array and nested arrays, and transforms the last axis (`rfft([[1,2,3,4],[5,6,7,8]])` is `{ re: [[10,-2,-2],[26,-2,-2]], im: [[0,2,0],[0,2,0]] }`). A ragged array throws a `DimensionError`, as `fft` does. The type of `rfft(matrix)` and `rfft(Float64Array)` is `{ re: unknown; im: unknown }`, not `number[][]`.
- `irfft` returned `null` values for a Matrix half-spectrum. Each part can be an array, a typed array or a Matrix.
- `fftn([1,2,3,4])` and `fftn(matrix)` threw `TypeError`. `fftn` takes 1-D and N-D input and a Matrix, and returns plain arrays (`fftn([1,2,3,4])` equals `fft`).
- `periodogram([])` threw `RangeError`. It returns `{ psd: [], frequencies: [] }`, as SciPy does. `periodogram([5])` returned two entries, the second NaN at frequency 1; it is `{ psd: [25], frequencies: [0] }`.
- `periodogram` with an `nfft` that is not a power of two, or shorter than the signal, gave a spectrum that differs from SciPy. Any positive integer `nfft` now works, and a longer signal is cropped to `nfft` samples, as SciPy does. An `nfft` that is not a positive integer throws a `RangeError`. `periodogram(matrix)` threw an accidental `RangeError`; it throws a `TypeError` that names `periodogram`. A typed array is accepted.
- `multiTaperPSD([])` returned `{ psd: [0], frequencies: [NaN] }` and `multiTaperPSD([5])` returned two entries, the second NaN. An empty signal returns `{ psd: [], frequencies: [] }`, and one sample throws a `RangeError`.
- `fft2d([])` and `fft2d([[]])` keep their input shape instead of a padded 1x1 result. `fft2d(matrix)` threw an accidental `TypeError`; it throws `TypeError: fft2d: expected a 2-D array`.
- `dotDivide([[[]],[[]]], 2)` returned `[[0],[0]]`. It keeps the shape `[[[]],[[]]]`, as mathjs does: a matrix made from a nested array now records the size of every axis.
- `conj(matrix([1,2]))` returned a plain Array. It returns a Matrix, as mathjs does.
- The `ifft(arr, n)` signature is in the type declarations.
