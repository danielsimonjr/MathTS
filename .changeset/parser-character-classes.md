---
'@danielsimonjr/mathts-expression': minor
---

Breaking: a radical sign parses as a function call. `√x` is `sqrt(x)` (a `FunctionNode`), not an `OperatorNode`, so `toString()` is `sqrt(2)` and `toTex()` is `\sqrt{2}` (#885). `∛` is `cbrt` and `∜` is `nthRoot(x, 4)`. `·`, `×`, `÷` and `−` are operators. A Unicode mathematical digit is a parse-time `SyntaxError` (#922).
