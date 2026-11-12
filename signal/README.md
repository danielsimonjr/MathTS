# @danielsimonjr/mathts-signal

Standalone signal processing for [MathTS](https://github.com/danielsimonjr/mathts).

A focused entry point over the `signal` typed-function domain in
[`@danielsimonjr/mathts-functions`](https://www.npmjs.com/package/@danielsimonjr/mathts-functions).
The implementation is re-exported, not duplicated. These are MathTS typed
functions (polymorphic dispatch across number / Complex / Fraction / BigNumber /
Matrix where supported).

## Install

```sh
npm install @danielsimonjr/mathts-signal
```

## What it exports

`fft`, `ifft` (aliases of `parallelFFT` / `parallelIFFT` on packed `Float64Array` spectra), `parallelFFT`, `parallelIFFT`, `parallelFFTMagnitude`, `parallelFFTPower`, `parallelConv`, `parallelXCorr`, `parallelAutoCorr`, `crossCorrelation`, `autoCorrelation`, `groupDelay`, `unwrapPhase`, `dct`, `idct`, `dst`, `idst`, `dwt`, `fourier`, `invFourier`, `hilbertTransform`, `periodogram`, `lowpassFilter`, `highpassFilter`, `bandpassFilter`, `resample` (two-arg SciPy Fourier length resample, or three-arg linear rate change), `medfilt`, `windowFunction` (`(length, type)` or SciPy `(type, length)`), `convolve`, `correlate`, `welchPSD`, `bartlettPSD`, `multiTaperPSD`, `goertzel`, `chirpZTransform` (plus the `typedSignal` bundle).

## License

MIT (c) Daniel Simon Jr.
