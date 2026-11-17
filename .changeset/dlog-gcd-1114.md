---
'@danielsimonjr/mathts-functions': patch
---

`discreteLog(g, h, p)` now solves `g^x = h (mod p)` when `g` and `p` share a factor. It divides the common factors out of `p` and `h`, then runs baby-step giant-step on the reduced modulus. Before, it returned a wrong value. For example, `discreteLog(2, 6, 10)` returned `5` and now returns `4`; `discreteLog(0, 2, 6)` returned `4` and now returns `-1`. A target that shares a factor with the reduced modulus has no solution, so the function returns `-1` and no longer throws a `RangeError` for a large modulus (`discreteLog(6, 0, 2^53 - 1)`). An input that threw a `RangeError` only because `g` and `p` share a factor now returns a value. The `RangeError` stays when the reduced modulus `N` needs more than 2^24 baby steps (`N - 1 > 2^48`) and the order of `g` modulo `N` is above 2^24. Its message now names the caller's `p` and the reduced modulus.
