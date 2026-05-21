---
"@danielsimonjr/mathts-workerpool": minor
"@danielsimonjr/mathts-parallel": minor
"@danielsimonjr/mathts-functions": minor
---

Fix and extend parallel execution.

- **workerpool** — `MathWorkerPool` created its pool with `createPool(null)`, so
  workerpool loaded its generic worker instead of the MathTS kernels and every
  named-kernel dispatch threw `Unknown method`. The built `dist/worker.js` is
  now resolved and loaded, so the parallel layer runs in workers for the first
  time. Float64Array chunking is fixed (`subarray` shared the whole buffer →
  `slice`). Adds the generic `applyKernel` (unary) and `applyKernel2` (binary)
  worker kernels and a batched-FFT kernel (`fftBatchChunk` / `fftBatch`).
- **parallel** — `ComputePool` exposes `applyKernel` / `applyKernel2` / `fftBatch`.
- **functions** — parallel `Float64Array` overloads for all 10 distribution
  functions and all 28 special functions; `parallelFFTMagnitude` /
  `parallelFFTPower` now dispatch to worker threads; `spectrogram`, `fft2d`, and
  `parallelConv` (with `parallelXCorr` / `parallelAutoCorr`) dispatch their
  independent FFTs to the worker pool; `parallelFFT` / `parallelIFFT` run a
  genuinely parallel single transform via a four-step decomposition. Completes
  the element-wise `Float64Array` overloads across arithmetic and trigonometry,
  and adds a parallel `parallelStatProd` reduction. Adds the parallel all-pairs
  `distanceMatrix` geometry function and the WebGPU-accelerated matrix
  operations `gpuMatmul`, `gpuAdd`, `gpuTranspose`, and `gpuScale` (new async
  exports, transparent CPU fallback, f32 GPU path).

  **Breaking:** `characteristicPolynomial`, `matrixPower`, `matrixLog`,
  `polarDecomposition`, `jordanForm`, `spectrogram`, `fft2d`, `parallelIFFT`,
  and `parallelStatProd`'s `Float64Array` overload are now async — their
  O(n^3) products / FFT batches / reductions are offloaded to the worker pool.
