---
'@danielsimonjr/mathts-functions': minor
---

`zeros`, `ones`, `identity`, `range`, `resize`, `hadamardMatrix`, `stirlingS1`, `stirlingS2` and `bellNumbers` check the size of the result before they allocate, and throw a `RangeError` instead of hanging or running out of memory (Refs #990). `functions/src/utils/limits.ts` holds the shared `assertAllocSize` and `assertLoopOrder` checks.

BREAKING:

- A dense result of more than 100000000 elements throws `RangeError` (`zeros(100000, 100000)`, `identity(1e6)`, `range(0, 1e9)`). A sparse result is not limited.
- `stirlingS1` with `n >= 10000` throws `RangeError` (`n = 9999` still returns, after about 2 s).
- `hadamardMatrix(16384)` and larger throw `RangeError`. `hadamardMatrix` also rejects a non-safe-integer `n` (`2**32`, `1e308`) as not a power of 2.
- `bellNumbers(n)` returns `Infinity` for a number `n > 218`.
- `resize` and `matrix.resize` throw `RangeError` above the limit. This includes a string (`resize('ab', [1e9])`) and a size with a zero dimension (`resize([1], [1e9, 0])`).
- `stirlingS2(n, k)` throws `RangeError` when `(n + 1)(k + 1)` exceeds 100000000.
- `bellNumbers` with a BigNumber `n` above 2000 throws `RangeError`.
- `range` with bigint bounds throws `RangeError` above the limit (`range(0n, 10n ** 12n)`).
