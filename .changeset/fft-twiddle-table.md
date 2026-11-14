---
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-workerpool': minor
---

The radix-2 FFT cores read each twiddle from a table of one `Math.cos` and one `Math.sin` call per index. The earlier cores multiplied each twiddle by the step, so the rounding error grew with the index. The round trip `parallelFFT` then `parallelIFFT` at n = 4096 was 640 ULP of the largest sample; it is about 4 ULP now. The spectrum of a power-of-two length changes in the last bits, so this release is minor and not patch. The `workerpool` copy and the `functions` copy give the same bits on one runtime. Two runtimes can still differ in the last bit, because V8 and JavaScriptCore round `Math.cos` and `Math.sin` differently.
