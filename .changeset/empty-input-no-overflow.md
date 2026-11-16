---
'@danielsimonjr/mathts-functions': patch
---

Empty input no longer overflows the stack (#988). `fft([])`, `ifft([])` and `fftn([])` return an empty result, as `fft(new Float64Array(0))` does, and `rfft([])` returns an empty half-spectrum. An input with a zero-length dimension keeps its shape (`fft([[]])` is `[[]]`, `fft(zeros(3, 0))` has size `[3, 0]`), and a jagged input throws a `DimensionError`. `irfft(spec, 0)` and `rfftfreq(0)` return `[]` instead of `[NaN]`, as `fftfreq(0)` does. `closestPair` of a Matrix throws a `TypeError` instead of overflowing the stack.
