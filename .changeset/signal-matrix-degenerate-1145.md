---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-wasm': patch
---

Matrix input and degenerate input of the signal functions now give a correct value or a named error. Results before the change:

- `dct`, `idct`, `dst`, `idst`, `hilbertTransform` and `spectrogram` of a Matrix returned `[null]`, `[]` or a `RangeError` about `NaN`. Each now throws `TypeError: <name>: signal must be an array or a typed array`. Arrays and typed arrays give the same values as before.
- `fftshift` and `ifftshift` of a Matrix threw `arr.slice is not a function`. They now unwrap a Matrix or a typed array and return a plain array. A nested array or a 2-D Matrix is now shifted along every axis, as NumPy does: `fftshift([[1, 2], [3, 4]])` returned `[[3, 4], [1, 2]]` (the first axis only) and now returns `[[4, 3], [2, 1]]`.
- `fftshift` and `ifftshift` of an array of odd length were swapped with respect to NumPy: `fftshift([0, 1, 2, 3, 4])` returned `[2, 3, 4, 0, 1]`. It now returns `[3, 4, 0, 1, 2]`, and `ifftshift` returns `[2, 3, 4, 0, 1]`, as `numpy.fft.fftshift` and `numpy.fft.ifftshift` do. Results for an even length are unchanged.
- `welchPSD([5, 6])` and `welchPSD([5, 6, 7, 8], { frameLength: 2 })` returned `NaN`, because a Hann window of length 2 is `[0, 0]`. They now throw `RangeError: welchPSD: a 'hann' window of length 2 is all zeros`. Other windows of length 2 give finite values. `periodogram([5, 6])`, `csd([5, 6], [5, 6])` and `coherence([5, 6], [5, 6])` returned `NaN` for the same window and now throw `RangeError` too. `spectrogram([5, 6])` and `spectrogram([5, 6, 7, 8], { windowSize: 2 })` returned a magnitude of all zeros for the same window and now throw `RangeError` too.
- `multiTaperPSD([1, 2, 3, 4, 5])` returned five bins on the wrong frequency grid, with the last two bins 0. Each taper is now zero-padded to `nfft`, and the result equals the NumPy periodogram of the tapered signal. For `n = 5000` and the default `nfft` of 8192, every bin above 2500 was 0. An `nfft` or a `K` that is not a positive integer returned `NaN` bins or a PSD of zeros (`multiTaperPSD([1, 2, 3, 4, 5], { nfft: 2.5 })`) and now throws `RangeError`.
- `medfilt` and `findPeaks` of a Matrix returned `[null]` and `[]`. Each now throws a `TypeError` that names the function.
- `medfilt` now pads the signal with zeros at both ends, as `scipy.signal.medfilt` does. This changes the values at the edges: `medfilt([0, 1, 5, 1, 0])` returned `[1, 1, 1, 1, 1]` and now returns `[0, 1, 1, 1, 0]`. A window longer than the signal is padded with zeros too: `medfilt([1, 2, 3], 1e9)` returned `[2, 2, 2]` and now returns `[0, 0, 0]`. A window size that is not a positive integer now throws `RangeError`.
- `fftshift` and `ifftshift` of a ragged nested array returned a ragged result (`fftshift([[1, 2], [3]])` returned `[[3], [2, 1]]`). They now throw a `DimensionError` (a `RangeError`), as `rfft` does.
- `spectrogram([])` returned 129 frequencies. It now returns no frames, no times and no frequencies, as `welchPSD([])` does.
- `welchPSD` and `bartlettPSD` with an odd `frameLength` returned the last bin at half of its value. For an odd frame the last bin is below the Nyquist frequency, so it is doubled like the bins before it. `welchPSD([1, 5, 2, 8, 3, 9, 4, 7, 6, 10], { frameLength: 5, window: 'rect' })` returned a last bin of 11.9 and now returns 23.8. Results for an even frame are unchanged. The `welch_psd_f64` and `bartlett_psd_f64` kernels of the WASM package now return an empty array for a frame length that is not a power of two, because they zero-pad each frame to the next power of two and put the bins of any other frame on the wrong grid. The bridge sends only a power-of-two frame to a kernel, so the public functions are not affected.

`resample([], 2, 1)` returns `[]` and needs no change.

(Refs #1145)
