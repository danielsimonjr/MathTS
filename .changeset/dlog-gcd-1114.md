---
'@danielsimonjr/mathts-functions': patch
---

`discreteLog(g, h, p)` now solves `g^x = h (mod p)` when `g` and `p` share a factor, and for a composite `p`. It divides the common factors out of `p` and `h`, then runs baby-step giant-step on the reduced modulus. Before, it returned a wrong value or `-1` for a solvable input. For example, `discreteLog(2, 6, 10)` returned `-1` and now returns `4`. A case with no solution still returns `-1`. An input that threw a `RangeError` only because `g` and `p` share a factor now returns a value; the `RangeError` stays for a reduced modulus with a large order of `g`.
