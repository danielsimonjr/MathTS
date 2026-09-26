---
'@danielsimonjr/mathts-functions': patch
---

`polynomialGCD` (and so `polynomialLCM`, and the CAS rational simplification that uses it) is exact when every coefficient of both inputs is a safe integer: it runs a primitive pseudo-remainder sequence over ℤ[x] in `bigint` and returns the monic result. Floating-point Euclid, still used for non-integer inputs, cannot decide coprimality for high-degree inputs. It returned a spurious factor for 53 of 300 random coprime degree-266/cubic pairs, and missed a real common quadratic of degree-120 multiples.
