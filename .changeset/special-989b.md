---
'@danielsimonjr/mathts-functions': minor
---

Recurrences, series sums, node rules, `gaussQuad` and `discreteLog` check the size of their input before they loop, and throw a `RangeError` instead of running for ever or out of memory (Closes #989). The limits are the measured point where the call took about 20 s before this change. Each recurrence also stops at its first `NaN` (and `sphericalBesselK` at its first `Infinity`), so a huge order with an overflowing argument returns at once.

Also fixed:

- `besselJ(n, x)` with `|x| < n` rescaled its downward sweep too late and returned `NaN` when the sweep overflowed (`besselJ(200, 5)`, `besselJ(5, 1e-10)`, `besselJ(1e7, 5)`). It now scales by a power of 2 and returns the correct value (`4.76e-296`, `2.604e-54`) or `0` when J_n is below the smallest double.
- `sphericalBesselJ(n, x)` and `sphericalBesselI(n, x)` no longer allocate an array of `max(n, |x|)` elements, and no longer rescale that array on every overflow (`sphericalBesselJ(1e6, 5)` took 33.7 s and now takes 12 ms).
- `discreteLog` keys its baby-step table by number, not by string: `p = 1e14 + 31` takes 13.8 s and 1.1 GB (26.5 s and 2 GB before).
- `sphericalBesselY`, `sphericalBesselK` and `expn` return `NaN` for a non-number `x`.
- `polygamma(n, x)` and the factorial in `sphericalHarmonic` return `Infinity` for a factorial above 170 at once.
- `mathieuA`, `mathieuB`, `mathieuCe` and `mathieuSe` throw a `RangeError` (`order n must be at most 99, got 100`) where they threw a `TypeError` from an undefined mode.

BREAKING (each call returned before and now throws `RangeError`; the old time is the measured time at the limit):

- `besselJ`, `besselY`, `besselK`, `chebyshevT`, `hermiteH`, `laguerreL`, `legendreP`, `jacobiP`, `gegenbauerC`, `ferrersP`, `sphericalBesselJ/Y/I/K` with an order above 1000000000. `legendreP(1e9, 0.5)` took 18.9 s, `besselJ(1e9, 2e9)` 9.6 s, `jacobiP(1e9, ...)` 15.6 s, `ferrersP(1e9, 2, x)` 13.5 s.
- `sphericalBesselJ` and `sphericalBesselI` with `max(n, |x|)` above 1000000000 (before, an array of that size).
- `expn(n, x)` with `n` above 1000000000 and `0 < x <= 1` (`expn(1e9, 0.5)` took 23.6 s).
- `polygamma(n, x)` with `x` below -1500000000 (`polygamma(1, -1e9 + 0.5)` took 10.9 s).
- `besselJZeros(nu, k)` with `k` above 4000000 or `k * max(1, |nu|)` above 100000000 (`besselJZeros(0, 1e6)` took 4.3 s, `besselJZeros(1e8, 1)` 22.9 s).
- `siegelZ(t)` with `|t|` above 1700 (`siegelZ(1700)` took 22.4 s and returned `NaN`).
- `zipfPMF(k, s, n)` with `n` above 150000000 and `1 <= k <= n` (`zipfPMF(1, 1, 1e8)` took 11.5 s).
- `binomialTest(x, n)` with `n` above 40000000 (`binomialTest(5, 4e7)` took 18.2 s).
- `rootsLegendre(n)` with `n` above 10000 (`rootsLegendre(10000)` took 15.4 s).
- `rootsJacobi(n, a, b)` with `n` above 800 (`rootsJacobi(700, 0, 0)` took 13.2 s).
- `gaussQuad(f, a, b, n)` with `n` above 200000000 (`n = 2e8` took 17.1 s with a trivial `f`).
- `discreteLog(g, h, p)` with `ceil(sqrt(p - 1))` above 2^24 (`p` above about 2.8e14). The baby-step `Map` cannot hold more entries, so the call could not finish.
- `rootsHermite(n)` and `rootsLaguerre(n)` with `n` above 500 now throw `RangeError` at once. They threw an `Error` ("root scan found ...") after 3.5 s to 14 s before, for every `n` above about 200 (`rootsHermite`) and about 450 (`rootsLaguerre`), so no returning call changes.
