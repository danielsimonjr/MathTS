---
'@danielsimonjr/mathts-expression': minor
---

Resolve valueless unit symbols in the expression compiler, so `evaluate('1 km')` matches `unit(1, 'km')`. Names that are already on the math namespace (such as `min`) are unchanged, and a user-scope binding still wins.
