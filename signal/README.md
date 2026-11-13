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

## Example

```ts node
import { parallelFFT } from '@danielsimonjr/mathts-signal';

const x = new Float64Array([0, 1, 0, -1]);
// Float64Array dispatch is async (number[] is synchronous).
const { real, imag } = await parallelFFT(x);
console.log(real.length, imag.length);
```

## What it exports

`fft`, `ifft` (aliases of `parallelFFT` / `parallelIFFT`). A `number[]` input returns `{ real: Float64Array, imag: Float64Array, originalLength: number }` synchronously. A `Float64Array` input returns that object in a `Promise` (`await`). `real` and `imag` are the zero-padded power-of-two spectrum (`real.length === nextPowerOf2(originalLength)`), not a length-n NumPy vector. The length-n `Complex[]` transform is factory `fft` from `@danielsimonjr/mathts-functions`. `ifft` of that object inverts the padded spectrum; the first `originalLength` samples of `.real` recover a real series. Also `parallelFFT`, `parallelIFFT`, `parallelFFTMagnitude`, `parallelFFTPower`, `parallelConv`, `parallelXCorr`, `parallelAutoCorr`, `crossCorrelation`, `autoCorrelation`, `groupDelay`, `unwrapPhase`, `dct`, `idct`, `dst`, `idst`, `dwt`, `fourier`, `invFourier`, `hilbertTransform`, `periodogram`, `lowpassFilter`, `highpassFilter`, `bandpassFilter`, `resample` (two-arg SciPy Fourier length resample, or three-arg linear rate change), `medfilt`, `windowFunction` (`(length, type)` or SciPy `(type, length)`; symmetric taps, SciPy `sym=True` / `get_window`, period `n - 1`), `convolve`, `correlate`, `welchPSD`, `bartlettPSD` (throw `RangeError` when the signal is shorter than `frameLength`; an empty signal returns an empty spectrum), `multiTaperPSD`, `goertzel`, `chirpZTransform` (plus the `typedSignal` bundle).

## License

MIT (c) Daniel Simon Jr.
