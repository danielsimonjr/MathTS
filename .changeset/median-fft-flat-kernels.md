---
'@danielsimonjr/mathts-functions': patch
---

`median` of a flat `number[]`, `Float32Array` or `Float64Array` makes one `Float64Array` copy and selects the middle value with quickselect. It no longer flattens the input into a second array first, and `parallelStatMedian` no longer sorts a NaN-free input. `fft(number[])` calls the flat kernel for every length from 64 up, so it makes two split buffers and no interleaved copy, and a length that is not a power of two no longer runs the recursive Complex path: from that length on, `fft(number[])` and `fft(Float64Array)` give the same bits. Recorded A/B against main: `tools/benchmark/ab/cases/ws-r.mjs`.
