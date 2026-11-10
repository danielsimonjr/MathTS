---
'@danielsimonjr/mathts-functions': minor
---

**Cost.** Before this change, these signatures sent arrays of 50 000 elements or more to worker threads. Now they run on the calling thread. The table gives the speed of the old worker path divided by the speed of the new synchronous path. The values come from 3 alternating old/new runs (medians of 9) at 5e4, 5e5 and 5e6 elements. A second build ran on the same computer, and the CPU load was 59-100% for most of the runs, so each cell gives the range over the runs. The ratios are not stable enough to give one break-even size.

| Functions                                                 | Old worker path, faster by                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `erfc`, `erfi`, `digamma`, `lambertW`, `besselK`          | 1.2-8.6x                                                                      |
| `normalCDF`                                               | 0.6-6.1x                                                                      |
| `sinIntegral`, `fresnelC`, `legendreP`                    | 0.2-4.1x                                                                      |
| `poissonPMF`                                              | 0.09-0.67x (the synchronous path is faster)                                   |
| `fft2d`                                                   | 0.3-1.3x                                                                      |
| `spectrogram`                                             | 0.16-2.7x                                                                     |
| arithmetic and trigonometry unary ops                     | 0.2-2.1x (`sign`, `floor`, `ceil`, `fix`, `log10` and `atanh` are faster now) |
| `matmul` (against `computePool.matmul`, 32 to 512 square) | 0.49-0.93x (the synchronous path is faster at every size)                     |

**To use worker threads**, call the path that the `parallel` package documents. The tests in `functions/tests/worker-kernel-paths.test.ts` show that each path reaches the workers (`parallelized === true`) and gives the synchronous result bit for bit:

- Special functions and distributions: `computePool.applyKernel(x, workerKernel(name, ...params))`. `workerKernel` is a new export. It gives the kernel source of the 31 element-wise special functions and the 8 element-wise distributions. Give the scalar parameters in the order of the typed signature. Do not give the array. For example, use `workerKernel('besselK', n)` and `workerKernel('normalCDF', mu, sigma)`.
- `fft2d` and `spectrogram`: put the frames in one buffer and call `computePool.fftBatch(real, imag, frameCount, frameLength)`.
- Element-wise arithmetic and trigonometry: the `computePool` method (for example `computePool.add`) or `computePool.applyKernel`.
- `matmul`: `computePool.matmul`.

**Changed functions.** These typed signatures are now synchronous. They return the value, not a `Promise`, so code that calls `.then` on the result breaks. `await` on the result still works.

- Trigonometry, `Float64Array`: `sin`, `cos`, `tan`, `csc`, `sec`, `cot`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`. The WASM tier stays first.
- Bitwise, `Int32Array`: `bitAnd`, `bitOr`, `bitXor`, `bitNot`, `leftShift`, `rightArithShift`, `rightLogShift`. A length mismatch now throws `RangeError('Dimension mismatch (m != n) in element-wise operation')`. Before, the error was `Error('<op>: lengths must match (<m> vs <n>)')`.
- Matrix helpers: `matmul`, `transpose`, `matvec`, `outer`. `matmul` uses `matmulSequential`, the kernel of the worker path, so the results are equal bit for bit.
- Matrix operations: `matMul`, `characteristicPolynomial`, `matrixPower`, `matrixLog`, `polarDecomposition`, `jordanForm` and the other functions of `matrix-ops`.
- Integration: `trapzF64`, `simpsonF64`. They use `pairwiseSum`. `gaussQuad` and `romberg` stay async, because the `workerCount` option sends sub-domains to workers.
- Signal: `fft2d`, `spectrogram`. `parallelFFTMagnitude` and `parallelFFTPower` stay async.
- Special functions, `Float64Array`: the 31 functions that `workerKernel` names, for example `erfc`, `lgamma`, `besselJ0`, `besselK`, `airyAi`, `fresnelC`. The WASM tier stays first.
- Distributions, `Float64Array`: `normalPDF`, `normalCDF`, `exponentialPDF`, `exponentialCDF`, `poissonPMF`, `binomialPMF`, `geometricPMF`, `bernoulliPMF`.
