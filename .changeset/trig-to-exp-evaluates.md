---
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-functions': patch
---

The default evaluator binds the imaginary unit `i`. Its operators and functions take a complex value: `+ - * / ^`, unary minus, `exp`, `sin`, `cos`, `tan`, `sqrt`, `cbrt`, `abs` and `log`. `mod` and `nthRoot` throw a `TypeError` on a complex value, as in mathjs. `trigToExp` now puts parentheses around each argument and each result, handles nested calls, and leaves `asin` and `sinh` unchanged. Its output evaluates to the value of its input (#1025).
