---
'@danielsimonjr/mathts-functions': patch
---

`gcd` and `lcm` take Fractions and more than two values. `gcd(fraction(1, 2), fraction(1, 3))` is `1/6` and `lcm(fraction(1, 2), fraction(1, 3))` is `1`, as in mathjs, and a Fraction with a number reads the number as a Fraction (`gcd(fraction(1, 2), 3)` is `1/2`). `gcd(4, 6, 8)` is `2` and `lcm(4, 6, 8)` is `24`, for numbers, bigints, BigNumbers and Fractions. The type `GcdFunction` has overloads that return a Fraction for two Fractions and take any count of arguments of the same type. Before, `gcd` of two Fractions returned a BigNumber and both functions took exactly two arguments. (Refs #1096)
