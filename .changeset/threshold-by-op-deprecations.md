---
'@danielsimonjr/mathts-parallel': minor
---

Seven `thresholdByOp` keys are now `@deprecated`: `erfc`, `besselJ`, `normalCDF`, `spectrogram`, `fft2d`, `matrixPower` and `characteristicPolynomial`. No function reads these keys. The typed functions with these names are synchronous and do not ask the pool. The keys stay in the type, so a caller that sets them does not break. Instead of each key, use the function itself, or one of these worker paths:

- `erfc`, `besselJ`, `normalCDF`: `computePool.applyKernel(x, workerKernel(name, ...params))`.
- `spectrogram`, `fft2d`: `computePool.fftBatch`.
- `matrixPower`, `characteristicPolynomial`: `computePool.matmul` for the products.

New exported types: `ThresholdByOp`, the type of `thresholdByOp` and of `DEFAULT_THRESHOLD_BY_OP`, which carries the deprecation notes. `DeprecatedThresholdOp` is the union of the seven keys.
