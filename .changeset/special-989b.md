---
'@danielsimonjr/mathts-functions': minor
---

Recurrences, series sums, node rules, `gaussQuad` and `discreteLog` check the size of their input before they loop, and throw a `RangeError` instead of running for ever or out of memory (Closes #989). Each limit is near the order where the call takes about 20 s; the list below gives the old-build time at or near each limit. Each recurrence also stops at its first `NaN` (and `besselK` and `sphericalBesselK` at their first `Infinity`), so a huge order with an overflowing argument returns at once.

Also fixed:

- `besselJ(n, x)` with `|x| < n` rescaled its downward sweep too late and returned `NaN` when the sweep overflowed (`besselJ(200, 5)`, `besselJ(5, 1e-10)`, `besselJ(1e7, 5)`). It now scales by a power of 2. `besselJ(n, x)` for integer `n >= 2` returns the value to about 1e-13, and 0 only when J_n is below the smallest double (`besselJ(10, 1e-10)` is `2.69e-110`, `besselJ(1e9, 5)` is `0` at once).
- `sphericalBesselJ(n, x)` and `sphericalBesselI(n, x)` no longer allocate an array of `max(n, |x|)` elements, and no longer rescale that array on every overflow (`sphericalBesselJ(1e6, 5)` took 33.7 s and now takes 12 ms).
- `discreteLog` keys its baby-step table by number, not by string: `p = 1e14 + 31` takes 13.8 s and 1.1 GB (26.5 s and 2 GB before).
- `discreteLog` for a large `p` first finds the order of `g`. A base of order at most 2^24 returns its answer (`discreteLog(50154588067499, 266974891273491, 282000011339987)` is `12345` in 0.3 s to 2 s; it took 14.5 s before).
- `zipfPMF(k, s, n)` with `n` above 1e8 sums the first 1e6 terms and an Euler-Maclaurin tail (relative error about 3e-14), so every `n` returns at once. `n` up to 1e8 gives the same value as before.
- `binomialTest` sums only the terms within `sqrt(375 n)` of `n p`; every other term is exactly 0, so the results do not change.
- `binomialTest` with `p` outside (0, 1) or `NaN` returns a `NaN` p-value at once (`binomialTest(5, 1e9, 1)` ran for more than 60 s and gave the same `NaN`).
- `expn(n, x)` with a tiny `x` returns `e^-x / (n - 1)` once the recurrence stops changing; the value is bit-identical (`expn(1.2e9, 1e-300)` ran for more than 60 s).
- `sphericalBesselK` returns 0 at two zeros in a row (`sphericalBesselK(1.8e9, 1.8e9)` took 32.8 s).
- `siegelZ(t)` returns `NaN` at once from `|t|` about 55 (the Borwein coefficients overflow). It returned the same `NaN` before, after a time that grew with t squared.
- `hermiteH` and `besselK` have no order limit; they return at the first `NaN` or `Infinity` (`besselK` also at two zeros in a row).
- `gaussQuad` returns `NaN` for a `NaN` interval count.
- `sphericalBesselY`, `sphericalBesselK` and `expn` return `NaN` for a non-number `x`.
- `polygamma(n, x)` and the factorial in `sphericalHarmonic` return `Infinity` for a factorial above 170 at once.
- `mathieuA`, `mathieuB`, `mathieuCe` and `mathieuSe` throw a `RangeError` (`order n must be at most 99, got 100`) where they threw a `TypeError` from an undefined mode.

BREAKING (each call returned before and now throws `RangeError`; the time is the old-build time at or above the limit):

- `besselJ`, `besselY` and `legendreP` with an order above 2500000000 (`besselJ(2.5e9, 5e9)` took 21.1 s, `legendreP(2.5e9, 0.5)` 29.2 s on the old build). `besselJ` with a small `x` returns 0 at any order.
- `besselJ(n, x)` with `x <= n` (the downward sweep) when the sweep starts above order 1200000000 (`besselJ(5e8, 5e8 - 1)` took 8.0 s and returned `NaN` on the old build; `besselJ(2.5e9, 2.5e9 - 1)` did not finish in 60 s). `hankelH1` and `hankelH2` follow.
- Each other recurrence family has its own limit (old-build time at 1e9 in brackets; the limit is below the old 20 s point where that time is under 20 s):
  - `jacobiP` above 1000000000 (19.9 s).
  - `gegenbauerC` above 1000000000 (16.5 s).
  - `ferrersP` above 1000000000 (14.9 s).
  - `laguerreL` above 1000000000 (14.7 s).
  - `expn` above 1200000000 for `0 < x <= 1` (12.7 s at 1e9). A tiny `x` exits the recurrence at once with the same value.
  - `sphericalBesselJ/Y/I/K` with an order above 1800000000, and `sphericalBesselJ/I` with `max(n, |x|)` above 1800000000 (`sphericalBesselY(1.5e9, 2e9)` took 15.9 s).
- `chebyshevT` with an order above 4000000000 (`chebyshevT(3.5e9, 0.5)` took 17.5 s).
- `polygamma(n, x)` with `x` below -2000000000 (a shift of 2.5e9 took 24.2 s).
- `besselJZeros(nu, k)` with `k` above 7000000 (`k = 7.5e6` took 22.3 s) or `k * max(1, |nu|)` above 100000000 (`besselJZeros(1e8, 1)` took 22.9 s).
- `binomialTest(x, n)` with `n` above 100000000000.
- `rootsLegendre(n)` with `n` above 14000 (`rootsLegendre(14000)` took 20.7 s).
- `rootsJacobi(n, a, b)` with `n` above 1300 (`rootsJacobi(1200, 0, 0)` took 14.0 s).
- `gaussQuad(f, a, b, n)` with `n` above 800000000 (`n = 1e9` took 26.1 s with a trivial `f`).
- `discreteLog(g, h, p)` throws when `p` needs more than 2^24 baby steps and the order of `g` is above 2^24 (or `g` and `p` share a factor). A base of smaller order still returns. A `p` above 2^53 - 1 also throws.
- `rootsHermite(n)` and `rootsLaguerre(n)` with `n` above 500 now throw `RangeError` at once. They threw an `Error` ("root scan found ...") after 3.5 s to 14 s before, for every `n` above about 200 (`rootsHermite`) and about 450 (`rootsLaguerre`), so no returning call changes.
