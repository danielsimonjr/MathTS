---
'@danielsimonjr/mathts-compat': minor
'@danielsimonjr/mathts-core': patch
---

Compat `create(all)` binds the mathjs-shaped factories (#1550, #1583, #1587, #1588). Complex `variance`/`std` on the compat instance follow mathjs `diff * diff`; native `functions` statistics stay NumPy-correct. Fraction and Complex `ceil`/`floor` honor the digit-count argument.
