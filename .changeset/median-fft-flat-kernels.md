---
'@danielsimonjr/mathts-functions': minor
---

`fft(number[])` calls the flat kernel for every length from 64 up. A length that is not a power of two now runs the Bluestein kernel of `fft(Float64Array)`, so the spectrum changes in the last bits for lengths such as 65, 100 and 1000. `median` of a flat `number[]`, `Float32Array` or `Float64Array` makes one `Float64Array` copy and selects with quickselect. `median` of two large equal values no longer overflows.
