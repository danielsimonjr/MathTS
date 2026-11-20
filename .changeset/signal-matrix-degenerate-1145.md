---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-wasm': patch
---

Matrix input and degenerate input of the signal functions now give a correct value or a named error. Results before the change:

- `dct`, `idct`, `dst`, `idst`, `hilbertTransform` and `spectrogram` of a Matrix returned `[null]`, `[]` or a `RangeError` about `NaN`. Each now throws `TypeError: <name>: signal must be an array or a typed array`. Arrays and typed arrays give the same values as before.
- `fftshift` and `ifftshift` of a Matrix threw `arr.slice is not a function`. They now unwrap a Matrix or a typed array and return a plain array. A nested array or a 2-D Matrix is now shifted along every axis, as NumPy does: `fftshift([[1, 2], [3, 4]])` returned `[[3, 4], [1, 2]]` (the first axis only) and now returns `[[4, 3], [2, 1]]`.
- `fftshift` and `ifftshift` of an array of odd length were swapped with respect to NumPy: `fftshift([0, 1, 2, 3, 4])` returned `[2, 3, 4, 0, 1]`. It now returns `[3, 4, 0, 1, 2]`, and `ifftshift` returns `[2, 3, 4, 0, 1]`, as `numpy.fft.fftshift` and `numpy.fft.ifftshift` do. Results for an even length are unchanged.
- `welchPSD([5, 6])` and `welchPSD([5, 6, 7, 8], { frameLength: 2 })` returned `NaN`, because a Hann window of length 2 is `[0, 0]`. They now throw `RangeError: welchPSD: a 'hann' window of length 2 is all zeros`. Other windows of length 2 give finite values. `periodogram([5, 6])`, `csd([5, 6], [5, 6])` and `coherence([5, 6], [5, 6])` returned `NaN` for the same window and now throw `RangeError` too.
- `multiTaperPSD([1, 2, 3, 4, 5])` returned five bins on the wrong frequency grid, with the last two bins 0. Each taper is now zero-padded to `nfft`, and the result equals the NumPy periodogram of the tapered signal. For `n = 5000` and the default `nfft` of 8192, every bin above 2500 was 0. An `nfft` or a `K` that is not a positive integer returned `NaN` bins or a PSD of zeros (`multiTaperPSD([1, 2, 3, 4, 5], { nfft: 2.5 })`) and now throws `RangeError`.
- `spectrogram([])` returned 129 frequencies. It now returns no frames, no times and no frequencies, as `welchPSD([])` does.
- `welchPSD` and `bartlettPSD` with an odd `frameLength` returned the last bin at half of its value. For an odd frame the last bin is below the Nyquist frequency, so it is doubled like the bins before it. `welchPSD([1, 5, 2, 8, 3, 9, 4, 7, 6, 10], { frameLength: 5, window: 'rect' })` returned a last bin of 11.9 and now returns 23.8. The `welch_psd_f64` kernel of the WASM package has the same rule. Results for an even frame are unchanged.

`resample([], 2, 1)` returns `[]` and needs no change.

(Refs #1145)
