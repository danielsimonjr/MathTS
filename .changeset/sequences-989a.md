---
'@danielsimonjr/mathts-functions': minor
---

Integer sequences and number-theory functions return their saturated value, or throw a `RangeError`, for a huge argument. Before, they looped for ever or ran out of memory (Refs #989). Where a value rounds to `Infinity` for a smaller argument, the function now returns `Infinity` for every larger argument at once: `lucasL(n)` above 1474, `subfactorial(n)` above 170, `doubleFactorial(n)` above 300, `partitions(n)` from 79446, `motzkin(n)` above 654, `schroder(n)` above 407, `pell(n)` above 806, `tribonacci(n)` above 1167, `delannoy(m, n)` when `min(m, n)` is 405 or more, and `bernoulli(n)` for an even `n` above 258 (the sign is `-Infinity` when `n / 2` is even, else `Infinity`). `harmonicNumber(n)` above 1e7 uses the series `ln n + γ + 1/(2n) − 1/(12n²)`. `risingFactorial` and `fallingFactorial` return as soon as the product is `NaN`, zero or an infinity that later factors cannot change. `combinations` returns `Infinity` as soon as the product overflows. `mertens` uses a linear sieve, and `integerSqrt` uses a bigint Newton iteration, so `integerSqrt(10n ** 60n)` returns `10n ** 30n` at once.

BREAKING (each call returned a value, or ran for a very long time, before):

- `divisors(n)` and `divisorSigma(n, k)` throw `RangeError` when `n` is above 2^53 − 1 (`divisors(1e308)`).
- `prime(n)` throws `RangeError` when its sieve needs more than 100000000 entries (`prime(5e6)` returned after about 3 s). `primePi(n)` throws `RangeError` for `n` of 100000000 and above (`primePi(1e8)` returned after about 2 s).
- `risingFactorial(x, n)` and `fallingFactorial(x, n)` throw `RangeError` when `n` is above 10000000 and the product has not settled within 10000000 factors (`risingFactorial(-Infinity, 1e9)`).
- The factory `combinations` throws `RangeError` when `n` is not a safe integer and when `min(k, n - k)` is above 10000000. So `composition(1e308, 3)`, `catalan(1e9)` and `catalan(2e7)` (which returned `NaN`) throw. The exported typed `combinations(1e308, 3)` already returned `Infinity` and still does.
- `mertens(n)` throws `RangeError` for `n` above 10000000 (`mertens(1e9)`).
- `integerSqrt(n)` throws `RangeError` for a number that is not a safe integer (`integerSqrt(1e308)`, `integerSqrt(2.5)`). It accepts a bigint of any size.
- `pellSolve(d)` throws `RangeError` when the continued fraction of `√d` needs more than 20000 steps (`pellSolve(1000000017)`, `pellSolve(2 ** 53 - 1)`).
- `integerPartitionsGen(n)` throws `RangeError` for `n` above 70 (`n` from 71 returned a list of more than 4 million partitions).
- `eulerNumbers(n)` throws `RangeError` for `n` above 1000.
- `primorial(n)` throws `RangeError` for `n` above 1000000.
- `fareySequence(n)` throws `RangeError` when `3 n²` exceeds 100000000 (`n` above 5773).
- `bernoulliPolynomial(n, x)` and `eulerPolynomial(n, x)` throw `RangeError` for `n` above 10000.
