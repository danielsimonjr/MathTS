---
'@danielsimonjr/mathts-functions': patch
---

`discreteLog` returns a small answer for a modulus above 2^48 and uses less memory for the baby-step table (Fixes #1136, Fixes #1135).

- #1136: `discreteLog(3, 9, 2**53 - 111)` and `discreteLog(6, 36, 9007199254740898)` threw a `RangeError`. They now return 2. The function walks the powers of g once: it returns j at the first `g^j === h`, returns -1 when the walk returns to 1, and throws after 2^24 steps.
- #1135: the baby-step `Map` of 2^24 entries is a typed-array table (open addressing, `Float64Array` keys and `Uint32Array` values). `MAX_BABY_STEPS` stays 2^24. Measured with one `node` process per call at 100% machine load: `discreteLog(3, 5, 2**48 - 59)` took 61.7 s and 1057 MB before, 24.8 s and 461 MB after. `discreteLog(6, 10, 2**48 - 2)` took 76.5 s and 980 MB before, 17.1 s and 460 MB after. All results are equal.
