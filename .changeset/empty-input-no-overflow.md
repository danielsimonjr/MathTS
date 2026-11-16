---
'@danielsimonjr/mathts-functions': patch
---

`fft`, `ifft`, `rfft` and `fftn` of an empty array return an empty result instead of throwing `RangeError: Maximum call stack size exceeded` (#988). `fft`, `ifft` and `fftn` of `matrix([])` no longer overflow either. `rfft([])` returns `{ re: [], im: [] }`.
