---
'@danielsimonjr/mathts-functions': patch
---

`expToTrig` keeps the value of its input (#1087). It scans balanced parentheses, so a nested argument is no longer cut at the first `)`, and it adds parentheses around the angle and the result. `expToTrig('exp(i*(x+1))')` now returns `(cos((x+1)) + i*sin((x+1)))`; it returned `(cos((x+1) + i*sin((x+1)))` before (the angle `(x+1` lost its parenthesis, so `cos` closed early). `exp(x*i)` is also rewritten. An exponent that is a sum (`exp(i*x+1)`) and an unbalanced call stay as written. `trigToExp` and `expToTrig` share one internal scanner, `functions/src/typed/call-rewrite.ts`.
