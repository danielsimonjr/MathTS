---
'@danielsimonjr/mathts-functions': patch
---

`simplify` and `derivative` no longer throw `Cannot convert Complex number to Node` when a constant call such as `exp(1)`, `log(2)` or `sin(1)` folds to a real number (Fixes #986). `expand` no longer glues a function name to its argument, and it keeps a constant call whole (Fixes #987). `simplify('2^(1/2)*2^(1/2)')` no longer returns a huge ratio.

Before and after:

- `simplify('exp(1)*x')`: threw, now `2.718281828459045 * x` (mathjs 15.2.0 gives the same).
- `simplify('log(2)*x')`: threw, now `0.6931471805599453 * x`.
- `derivative('2^x', 'x')`: threw, now `0.6931471805599453 * 2 ^ x`.
- `derivative(symbolicIntegral('1/(x^2+1)', 'x'), 'x')`: threw, now an expression equal to `1 / (x^2 + 1)`.
- `simplify('2^(1/2)*2^(1/2)')`: `4.43365544449e+11 / 2.21682772224e+11`, now `2.0000000000000004` (mathjs gives the same).
- `expand('sqrt(2)*(x+1)')`: `sqrt2*x + 2*1`, now `sqrt(2)*x + sqrt(2)`.
- `expand('exp(1)*(x+1)')`: `exp1*x + 1*1`, now `exp(1)*x + exp(1)`.
- `expand('sin(x)*(x+1)')`: `sinx*x + x*1`, now returned unchanged.
- `expand('2^(1/2)*(8 + x)')`: gave a wrong value, now returned unchanged.
