---
'@danielsimonjr/mathts-compat': minor
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-functions': minor
---

Expose the mathjs factories through compat's `all` bundle for custom instances.
Export `num`, `den`, `compile`, and the mathjs type predicates from the functions package.
Use mathjs scalar signatures for trigonometric, exponential, and counting functions across named imports and instance expressions. Parsed nodes use the instance’s expression bindings. Compat also matches mathjs Unicode tokenization and complex square roots on the real axis.
