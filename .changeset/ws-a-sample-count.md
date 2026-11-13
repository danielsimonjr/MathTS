---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-statistics': patch
---

`Distribution.sample(n)` returns a `Float64Array` of `n` draws, and `sample()` still returns one number. Before, `sample(5)` returned one number and ignored the argument. `sample(n, opts)` throws `TypeError` (use `sampleN(n, { seed })` for a seeded batch), and a negative, non-integer or non-finite `n` throws `RangeError`, as does `n` above 2**26 (67,108,864; the check runs before the allocation) (#899).
