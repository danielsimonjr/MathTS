---
'@danielsimonjr/mathts-compat': minor
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-functions': patch
---

Compat `create(all)` matches mathjs **15.3.0** expression behavior by default (#1549, #1556, #1562, #1576, #1580): assignment, in-expression `help` / `config` / `parse` / `evaluate` / `compile` / `parser`, and `ResultSet` block results. Pass `{ safe: true }` on compat `evaluate` / `compile` / `parser` to opt back into the MathTS sandbox. Native `@danielsimonjr/mathts-expression` and `evaluate` from `@danielsimonjr/mathts-functions` stay safe by default (`{ unsafe: true }` opt-out); block statements keep native return semantics (ResultSet is enabled only when `compatBlockResultSet` is in the math scope). Expression assignment compilation fixes index/property scope-binding bugs (security). `createInstanceEvaluator` accepts optional compat-only unsafe-scope bindings without changing default native evaluate.
