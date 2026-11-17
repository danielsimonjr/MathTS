---
'@danielsimonjr/mathts-functions': patch
---

`discreteLog` returns a small answer for a modulus above 2^48 and uses less memory for the baby-step table (Fixes #1136, Fixes #1135).

- #1136: `discreteLog(3, 9, 2**53 - 111)` and `discreteLog(6, 36, 9007199254740898)` threw a `RangeError`. They now return 2. The function walks the powers of g once: it returns j at the first `g^j === h`, returns -1 when the walk returns to 1, and throws after 2^24 steps.
- #1135: the baby-step `Map` of 2^24 entries is a typed-array table (open addressing, two `Uint32Array`s, 8 bytes per slot: a 32-bit hash of the value and the step). `MAX_BABY_STEPS` stays 2^24. Measured with one `node` process per call, back to back: `discreteLog(3, 5, 2**48 - 59)` is 2.3 to 2.9 times faster (32.3 s to 14.0 s at the lowest machine load), and the peak resident memory of a process that loads this function alone goes from 1058 MB to 331 MB. The peak is about 480 MB in a process that loads the full package. The results are equal.
- The baby steps stop when the powers of `g` return to 1. `discreteLog(2, 11, 2**48 - 1)` (the order of 2 is 48) took 5.8 s and now takes less than 0.1 s.
