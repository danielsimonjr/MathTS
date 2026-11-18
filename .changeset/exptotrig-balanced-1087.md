---
'@danielsimonjr/mathts-functions': patch
---

`expToTrig` keeps the value of its input (#1087). It scans balanced parentheses, so a nested argument is no longer cut at the first `)`, and it adds parentheses around the angle and the result. `expToTrig('exp(i*(x+1))')` now returns `(cos((x+1)) + i*sin((x+1)))`; it returned `(cos((x+1) + i*sin((x+1)))` before (the angle `(x+1` lost its parenthesis, so `cos` closed early). A call is rewritten when its argument is a product with a factor `i` or `-i`, so `exp(x*i)`, `exp(2*i*x)` and `exp(x*-i*y)` are also rewritten. A call stays as written when its exponent is a sum (`exp(i*x+1)`), has an operator other than `*`, `/` and `^` (`exp(i*x?1:2)`), or does not balance. `trigToExp` and `expToTrig` share one internal scanner, `functions/src/typed/call-rewrite.ts`. In both functions a call that follows a name and white space (`x sin(y)`, `x exp(i*y)`) now stays as written; the output was `x (...)` before, which the parser reads as a call of `x`.
