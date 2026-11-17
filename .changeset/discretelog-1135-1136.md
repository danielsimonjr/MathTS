---
'@danielsimonjr/mathts-functions': patch
---

`discreteLog` returns a small answer for a modulus above 2^48 and uses less memory for the baby-step table (Fixes #1136, Fixes #1135).

- #1136: `discreteLog(3, 9, 2**53 - 111)` and `discreteLog(6, 36, 9007199254740898)` threw a `RangeError`. They now return 2. The function walks the powers of g once: it returns j at the first `g^j === h`, returns -1 when the walk returns to 1, and throws after 2^24 steps.
- #1135: the baby-step `Map` of 2^24 entries is a typed-array table (open addressing, two `Uint32Array`s, 8 bytes per slot). `MAX_BABY_STEPS` stays 2^24. Measured with one `node` process per call, back to back: `discreteLog(3, 5, 2**48 - 59)` is about 2.4 times faster (32.3 s to 13.4 s) and its peak resident memory goes from 1058 MB to 331 MB. The results are equal.
- The baby steps stop when the powers of `g` return to 1. `discreteLog(2, 11, 2**48 - 1)` (the order of 2 is 48) took about 24 s and now returns at once.
