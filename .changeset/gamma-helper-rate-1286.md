---
'@danielsimonjr/mathts-functions': minor
---

BREAKING: The third positional argument of `gammaPDF` is now the rate, in line with `gammaCDF`, `gammaQuantile`, and `gammaDist`. Pass `{ scale: theta }` to preserve previous positional-scale results. All four functions accept explicit `{ rate }` and `{ scale }` options.
