---
'@danielsimonjr/mathts-functions': patch
---

`simplify` and `derivative` no longer throw `Cannot convert Complex number to Node` when a constant call such as `exp(1)`, `log(2)` or `sin(1)` folds to a real number (Fixes #986). `expand` no longer glues a function name to its argument, and it keeps a constant call whole (Fixes #987). `simplify('2^(1/2)*2^(1/2)')` no longer returns a huge ratio.

Before and after:

- `simplify('exp(1)*x')`: threw, now `2.718281828459045 * x` (mathjs 15.2.0 gives the same).
- `simplify('log(2)*x')`: threw, now `0.6931471805599453 * x`.
- `derivative('2^x', 'x')`: threw, now `0.6931471805599453 * 2 ^ x`.
- `simplify('sin(1)/2')`: threw, now `0.42073549240394825`.
- `simplify('2^(1/2)*2^(1/2)')`: `4.43365544449e+11 / 2.21682772224e+11`, now `2.0000000000000004` (mathjs gives the same).
- A fraction next to an irrational constant now folds to a decimal, as in mathjs. `simplify('sqrt(2)/3*x')`: `x * 6.65857e+5 / 1.412496e+6`, now `0.4714045207910317 * x`. `simplify('1/3+sqrt(2)')`: `2.74267e+5 / 1.56944e+5`, now `1.7475468957064284`. An exact result stays a fraction (`simplify('sqrt(4)/3')` is `2 / 3`).
- `expand('sqrt(2)*(x+1)')`: `sqrt2*x + 2*1`, now `sqrt(2)*x + sqrt(2)`.
- `expand('exp(1)*(x+1)')`: `exp1*x + 1*1`, now `exp(1)*x + exp(1)`.
- `expand('sqrt(2)*(x+1)+sqrt( 2)*x')`: the two spellings of `sqrt(2)` now collect, to `2*sqrt(2)*x + sqrt(2)`. Only the whitespace next to `(`, `)` or `,` is ignored: `sqrt(2 e -3)` and `sqrt(2e-3)` stay two constants.
- `expand('sin(x)*(x+1)')`: `sinx*x + x*1`, now returned unchanged.
- `expand('2^(1/2)*(8 + x)')`: gave a wrong value, now returned unchanged.
- `expand('sin(1+2)^2')`: `sin1*1 + 1*2 + 2*1 + 2*2`, now returned unchanged.
- `pi` and `e` now distribute and collect as constants. `expand('(pi+x)^2')`: `pi*pi + pi*x + x*pi + x*x`, now `pi^2 + 2*pi*x + x^2`. `expand('pi*(x+1)')`: unchanged text, now `pi*x + pi`.
- An input that is a polynomial in its variables and its constants now comes back in the canonical polynomial form: `expand('x*e')` is `e*x`, and `expand('(x+pi)/2')` is `0.5*pi + 0.5*x`. A constant counts as one more variable, so the size and the time of the expansion are those of a polynomial with that number of variables (#1176). An input above the degree limit that contains a constant is returned unchanged, as before.
- `symbolicEqual` compares through `simplify`, so two results change, and both now agree with mathjs: `symbolicEqual('1/3+sqrt(2)-sqrt(2)', '1/3')` and `symbolicEqual('sqrt(2)/3+1/3', '(sqrt(2)+1)/3')` were `true` and are now `false`, because the decimal difference is not exactly 0 (#1178). `symbolicEqual('sqrt(2)*sqrt(2)*x', '2*x')` was `false` and is now `true`.
- `simplify('[1/3,2]*sqrt(2)')`: `[6.65857e+5 / 1.412496e+6, 6.65857e+5 / 2.35416e+5]`, now `[0.4714045207910317, 2.8284271247461903]`.

The `fractionsLimit` option has the same effect as before: `simplify('1/3 + 100', {}, { fractionsLimit: 50 })` is `301 / 3`.

A decimal constant that a fraction with a small denominator reproduces exactly still prints as a ratio, as it did before this change: `simplify('exp(10)*3')` threw, and is now `6.977852205e+9 / 1.05598e+5` (mathjs gives `66079.39738442015`). The value is correct (#1175).

`simplify('sqrt(2)')`, `derivative('sqrt(2)*x', 'x')` and `derivative(symbolicIntegral('1/(x^2+1)', 'x'), 'x')` from #986 already worked before this change. Tests now guard them.
