---
'@danielsimonjr/mathts-functions': patch
---

`rationalize`, `simplify` and `variables` match mathjs 15.2.0 in seven cases (Fixes #1177).

- `rationalize('(2/5+x*x - x)^4')` did not finish. The rule engine distributes a product of sums term by term, and its cost grows with the expansion. A one-variable expression whose expansion has more than 8 terms is now read with exact polynomial arithmetic. The coefficients of this example are the exact ones, and `rationalize('(1+x)^6')` is `x ^ 6 + 6 * x ^ 5 + 15 * x ^ 4 + 20 * x ^ 3 + 15 * x ^ 2 + 6 * x + 1`. mathjs does not finish on these inputs. `rationalize('(1-x)^5')` threw `Invalid ^ placing` after 30 seconds and now returns `-x ^ 5 + 5 * x ^ 4 - 10 * x ^ 3 + 10 * x ^ 2 - 5 * x + 1`.
- `rationalize('x^2/3+1/3')`, `rationalize('(x+1)^2/3')` and `rationalize('log(2)*x^2 + 1/3')` threw `Operator / invalid`, because a MathTS only expand step wrote a decimal coefficient as a fraction. The step now runs only when the direct read fails on a power. The three results are the mathjs texts, for example `0.3333333333333333 * x ^ 2 + 0.3333333333333333`. One text changes: `rationalize('(2/5+x)^2')` ends with `0.16000000000000003`, as in mathjs, and not `0.16`.
- `simplify('factorial(5)/7')` and `simplify('atan2(1,1)*x')` gave a 64-digit BigNumber. A function that gets Fractions and has no Fraction signature takes the core conversion to BigNumber. When no argument holds a BigNumber, the function is now called again with numbers, as mathjs does. The results are `120 / 7` and `0.7853981633974483 * x`.
- `simplify('det([1,2;3,4])*x')` stayed unevaluated, because the rows of a matrix literal were Matrices and so the matrix had the size `[2]`. The rows are now unwrapped: the result is `-(2 * x)`. `simplify('size([1,2])')` threw `m.valueOf(...).map is not a function`; it now returns `[2]`, as mathjs does.
- `variables('1e3*x')` returned `['e3', 'x']`. The exponent of a number literal is no longer read as a name.
- Pinned, already correct on main: `simplify('complex(2,0)*x')` is `2 * x` and `simplify('log(8,2)/3')` is `1`. (Refs #1177)
