---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-statistics': patch
---

`Distribution.sample(n)` returns a `Float64Array` of `n` draws, and `sample()` still returns one number. Before, `sample(5)` returned one number and ignored the argument. `sample(n, opts)` throws `TypeError` (use `sampleN(n, { seed })` for a seeded batch), and a negative or non-integer `n` throws `RangeError` (#899).
