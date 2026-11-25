---
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
---

Fraction `format`, `string`, and `ConstantNode.toString` parity (#1579, #1586): formatted integral Fractions as `n/1`, routed `string(fraction)` through `Fraction.toString()`, and matched mathjs Fraction-config `ConstantNode.toString()`. BREAKING: `format(fraction(2))` is now `"2/1"`, `string(fraction(1, 3))` is `"0.(3)"`, and Fraction-config `parse('1/3 + 1/4').toString()` is `"1/1 / 3/1 + 1/1 / 4/1"`.
