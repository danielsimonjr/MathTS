---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-signal': patch
---

Public FFT/signal fixes (dogfood G18): factory `fft` accepts `Float64Array`; `@danielsimonjr/mathts-signal` exports `fft`/`ifft` aliases; `welchPSD`/`bartlettPSD` throw when the signal is shorter than the frame; `resample(x, num)` matches SciPy Fourier resample; `windowFunction` accepts SciPy `(type, length)` argument order.
