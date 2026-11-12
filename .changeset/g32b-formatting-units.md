---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

Fraction `toString` uses terminating decimal form (0.1). `size` returns a Matrix when `config.matrix` is `Matrix`. `createUnit` is idempotent when the definition matches an existing unit. Size matrix `toString` matches mathjs `[2, 3]` layout.
