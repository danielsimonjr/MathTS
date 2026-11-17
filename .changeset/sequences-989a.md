---
'@danielsimonjr/mathts-functions': minor
---

Integer sequences and number-theory functions return their saturated value, or throw a `RangeError`, for a huge argument. Before, they looped for ever or ran out of memory (Refs #989). Where a value rounds to `Infinity` for a smaller argument, the function now returns `Infinity` for every larger argument at once: `lucasL(n)` above 1474, `subfactorial(n)` above 170, `doubleFactorial(n)` above 300, `partitions(n)` from 79446, `motzkin(n)` above 654, `schroder(n)` above 407, `pell(n)` above 806, `tribonacci(n)` above 1167, `delannoy(m, n)` when `min(m, n)` is 405 or more, `lahNumber(n, k)` when `n - k` is above 170, `narayana(n, k)` when `min(k, n + 1 - k)` is 262 or more, `eulerianNumber(n, k)` for `n` from 1024 and `1 <= k <= n - 2`, and `bernoulli(n)` for an even `n` above 258 (the sign is `-Infinity` when `n / 2` is even, else `Infinity`). `bernoulli(n)` for an even `n` from 652 returned `NaN` and now returns the signed infinity. `harmonicNumber(n)` above 100 uses the series `ln n + γ + 1/(2n) − 1/(12n²) + 1/(120n⁴) − 1/(252n⁶)`; the value moves by up to 2.7e-12 toward the exact value. `risingFactorial` and `fallingFactorial` return as soon as the product is `NaN` or zero; after an infinity they read the sign and any zero of the remaining factors from `x` and `n`, so a call with a huge `n` returns at once. `combinations` returns `Infinity` as soon as the product overflows. `mertens` uses a linear sieve. `prime` and `primePi` use a segmented sieve. `primorial` multiplies its primes in a balanced tree. `integerSqrt` uses a bigint Newton iteration, so `integerSqrt(10n ** 60n)` returns `10n ** 30n` at once; a number argument is floored, and a number below 2 now returns a bigint (`integerSqrt(1)` is `1n`, `integerSqrt(0.5)` is `0n`). `pellSolve(1000000017)` returns its 15570-digit solution in about 0.1 s.

New limits, each for a call that ran for minutes or did not return before:

- `prime(n)` and `primePi(n)` throw `RangeError` when the sieve limit is above 1e9: `prime(n)` for `n` above 48607823, `primePi(n)` for `n` above 1e9 (`primePi(1e9)` took 27 s and now takes about 8 s).
- `divisors(n)` and `divisorSigma(n, k)` throw `RangeError` when `sqrt(n)` is above 1e9 (`divisors(1e308)`).
- `mertens(n)` throws `RangeError` for `n` above 100000000 (`mertens(1e9)`).
- `primorial(n)` throws `RangeError` for `n` above 10000000.

BREAKING (each call returned a value, or ran for a very long time, before):

- The factory `combinations` throws `RangeError` when `n` is not a safe integer and when `min(k, n - k)` is above 10000000. So `composition(1e308, 3)`, `catalan(1e9)` and `catalan(2e7)` (which returned `NaN`) throw. The exported typed `combinations(1e308, 3)` already returned `Infinity` and still does.
- `integerPartitionsGen(n)` throws `RangeError` for `n` above 70 (`n` from 71 returned a list of more than 4 million partitions).
- `eulerNumbers(n)` throws `RangeError` for `n` above 1000.
- `fareySequence(n)` throws `RangeError` when `3 n²` exceeds 100000000 (`n` above 5773).
- `bernoulliPolynomial(n, x)` and `eulerPolynomial(n, x)` throw `RangeError` for `n` above 10000.
- `pellSolve(d)` throws `RangeError` when the continued fraction of `√d` needs more than 100000 steps (`pellSolve(2 ** 53 - 1)`).
- `egyptianFraction(p, q)` throws `RangeError` when `floor(p / q)` is above 10000000 (`egyptianFraction(3e7, 1)` returned 3e7 ones after 5.2 s).
