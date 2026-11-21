---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
---

The bigint greatest common divisor has one implementation, `gcdBigInt` in `@danielsimonjr/mathts-core/internal`. Before, `functions` had five private copies of it, and two copies of the modular power. Now `discreteLog`, `primitiveRoot`, `multiplicativeOrder`, `rationalNullspace`, `egyptianFraction`, the integer-polynomial gcd and the `bigint` branch of `gcd` use the shared code. The values do not change. (Refs #1137)
