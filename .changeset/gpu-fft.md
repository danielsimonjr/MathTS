---
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-gpu': minor
---

Add a **GPU FFT** (radix-2 Stockham autosort, f32) and fix a threshold bug that was silently
pessimising `parallelFFT` on the CPU.

**GPU FFT.** Stockham rather than textbook Cooley-Tukey because it is _self-sorting_: each pass
scatters into a second buffer, so the output arrives in natural order with **no bit-reversal
pass** — a bit-reversal is a pure memory shuffle, the one thing a GPU is worst at. All log₂(n)
passes go into one encoder and one submit. `parallelFFT` / `parallelIFFT` route through it when
you opt in with `enableGpu()`; with the flag off (the default) they are bit-identical f64.

Measured against `fftCoreFloat64` (the flat f64 core `parallelFFT` runs on this thread), warm
JIT, Chrome / NVIDIA Pascal — regenerate with `functions/tests/gpu-fft-bench.browser.test.ts`:

| n         | CPU f64  | GPU f32  | speedup   |
| --------- | -------- | -------- | --------- |
| 65,536    | 16.8 ms  | 14.4 ms  | 1.17×     |
| 262,144   | 53.4 ms  | 24.0 ms  | **2.23×** |
| 524,288   | 87.8 ms  | 30.5 ms  | **2.88×** |
| 1,048,576 | 253.1 ms | 79.7 ms  | **3.18×** |
| 2,097,152 | 399.9 ms | 116.3 ms | **3.44×** |

**~2.2–3.4× above the threshold**, and the ratio is genuinely noisy run to run — there is no
single hero number. f32 error is ~4e-7 peak-relative, even across 20 stages (error growth per
stage was the risk that could have killed the kernel; Stockham is well-behaved).

**The FFT's threshold is 262,144 — deliberately higher than `GPU_MIN_ELEMENTS` (65,536).** At
65,536 the GPU wins by only 1.17×: inside the noise, and nowhere near enough to justify dropping
f64 for f32. An FFT makes log₂(n) passes over the data, so it amortises the upload more slowly
than the memory-bound element-wise chain. Sharing one threshold would have been convenient and
wrong. Below it — and for non-power-of-two lengths, which chirp-z handles — it returns `null` and
you keep the exact f64 path.

**Fixed: `parallelFFT` ignored its own tuned threshold.** `shouldParallelize(paddedLength)` was
called without the op name, so `DEFAULT_THRESHOLD_BY_OP`'s benchmark-tuned `parallelFFT: 'never'`
was never consulted and the global 50,000 threshold applied instead — every transform above 50k
silently took the four-step worker path. That path does not pay: **n=2¹⁸, 156 ms via workers vs
77 ms on this thread** (2× slower) in Chrome; a wash in Node. The tuned decision was right and
simply never read.

**`@danielsimonjr/mathts-gpu` now exports `serializeGpu`.** The WebGPU error scope is a _per-device
LIFO stack_, so two dispatches in flight pop each other's scope and a real validation error can go
unobserved — returning a zero-filled buffer as a plausible result (for an FFT: a silently empty
spectrum). The queue must therefore be shared across the whole GPU surface, not per-module.

Also exported: `fftGpuDispatch`, `resetGpuFft`, `GpuFftOptions`, `GpuFftResult`.
