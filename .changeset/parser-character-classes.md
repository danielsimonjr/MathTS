---
'@danielsimonjr/mathts-expression': minor
---

Breaking: a radical sign parses as a function call. `√x` is `sqrt(x)` (a `FunctionNode`), not an `OperatorNode`, so `toString()` is `sqrt(2)` and `toTex()` is `\sqrt{2}` (#885). `∛` is `cbrt` and `∜` is `nthRoot(x, 4)`; both work in the expression package alone. The operand of a radical is the operand of unary minus (`√2^2` is `sqrt(2 ^ 2)`), and a radical can be the right operand of implicit multiplication (`2√3`). `·`, `⋅`, `×`, `÷` and `−` are operators. A Unicode mathematical digit is a parse-time `SyntaxError` (#922). mathjs 15.2.0 rejects these symbols; MathTS accepts them as a deliberate superset.
