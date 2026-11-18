---
'@danielsimonjr/mathts-functions': patch
---

`expToTrig` keeps the value of its input (#1087). It pairs the parentheses, so a nested argument is no longer cut at the first `)`, and it adds parentheses around the angle. `expToTrig('exp(i*(x+1))')` now returns `(cos((x+1)) + i*sin((x+1)))`; it returned `(cos((x+1) + i*sin((x+1)))` before (the angle `(x+1` lost its parenthesis, so `cos` closed early). A call is rewritten when its argument is a product with a factor `i` or `-i`, so `exp(x*i)`, `exp(2*i*x)` and `exp(x*-i*y)` are also rewritten. A call stays as written when its exponent is a sum (`exp(i*x+1)`), has an operator other than `*`, `/`, `^`, `!` and `'` (`exp(i*x?1:2)`), or does not balance.

`trigToExp` and `expToTrig` share one internal scanner, `functions/src/typed/call-rewrite.ts`. The scanner pairs the brackets in one pass, so a deep nest of calls that stay as written takes linear time. In both functions these calls now stay as written, because the output did not parse or changed value before:

- A call that follows a name and white space, or an index (`x sin(y)`, `x[1] exp(i*y)`, `2 in sin(y)`). The output was `x (...)`, which the parser reads as a call of `x`. A call after a number, a constant, a matrix or a word operator (`2 sin(y)`, `[1, 2] sin(y)`, `x mod sin(y)`) is rewritten.
- A method call (`x.sin(y)`). The output was `x.(...)`.
- Text in a string literal or a comment (`"sin(x)"`). The rewrite changed the value of the string.
- In `trigToExp`, a call with no argument or with two or more (`sin()`, `sin(x, y)`). The output was `exp(i*())` or `exp(i*(x, y))`.
