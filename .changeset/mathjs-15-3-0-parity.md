---
'@danielsimonjr/mathts-compat': minor
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-matrix': patch
---

Match the mathjs 15.3.0 behavior changes and pin the compat parity oracle at mathjs 15.3.0.

Updated `multinomial` (varargs, zeros, 2-D Dimension mismatch throw), `catalan(bigint)` (exact bigint), sparse element-wise ops (`dotPow`/`dotDivide`/`divide` evaluate implicit zeros), and `bigintToNumber` safe-integer range checks. BREAKING: out-of-range bigint-to-number conversions and 2-D `multinomial` inputs now throw; sparse `dotPow`/`dotDivide`/`divide` with non-zero image of 0 return `DenseMatrix`. The compat parity oracle is mathjs 15.3.0 (#1574): the pin, the regenerated parity names, the scheduled mathjs-oracle workflow, and the full-instance differential harness in `compat/tests/parity/`.
