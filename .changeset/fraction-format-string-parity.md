---
'@danielsimonjr/mathts-compat': patch
---

Fraction `format`, `string`, `print`, and Fraction-config `parse().toString()` match mathjs 15.3.0 (#1579, #1586). BREAKING: `format(fraction(2))` is `"2/1"`, `string(fraction(1,3))` is `"0.(3)"`, and Fraction-config `parse('1/3 + 1/4').toString()` is `"1/1 / 3/1 + 1/1 / 4/1"` on the compat instance only; native MathTS packages are unchanged.
