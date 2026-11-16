---
'@danielsimonjr/mathts-expression': patch
---

The default evaluator binds the imaginary unit `i`, and its arithmetic handles complex values. `trigToExp('sin(x)')` now evaluates: `evaluate(trigToExp('sin(x)'), {x: 0.5})` returns the sine of 0.5 instead of throwing `Undefined symbol "i"` (#1025). `+`, `-`, `*`, `/`, `^`, unary minus and `exp` take a complex operand. Real-only functions throw a `TypeError` on a complex argument.
