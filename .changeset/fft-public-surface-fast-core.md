---
'@danielsimonjr/mathts-functions': patch
---

Make the public `fft()` ~6× faster. No API change, no precision change.

`fft()` computed its butterflies in **Complex objects** — a `{ re, im }` allocation per
twiddle step and per butterfly — while a flat `Float64Array` radix-2 core already existed in
the same package (the one `parallelFFT` uses) and was ~8× faster for the identical transform.
The default FFT every consumer reaches was therefore the slowest one in the library.

Both surfaces now share one core (`signal/fft-core-f64.ts`); `ComplexNumber[]` is materialised
once at the boundary. Measured, same machine:

| n         | before  | after      | vs `parallelFFT` (raw Float64Array) |
| --------- | ------- | ---------- | ----------------------------------- |
| 262,144   | 607 ms  | **96 ms**  | 33 ms                               |
| 1,048,576 | 2987 ms | **521 ms** | 170 ms                              |

The remaining gap to `parallelFFT` is the `ComplexNumber[]` boxing itself, which is inherent
to that return type — use `parallelFFT` if you want the raw `Float64Array` spectrum.

Same f64 arithmetic, same 1/n inverse scaling, same results. Pinned by
`tests/benchmark/fft-public-surface.test.ts`.
