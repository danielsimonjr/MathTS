---
"@danielsimonjr/mathts-functions": minor
---

`lusolve` now throws when the LU factor is singular or non-finite (same pivot tolerance as `linsolve`), including consistent rank-deficient systems that previously returned a particular solution with free variables set to zero in `usolve`. Direct `usolve` still propagates NaN/±Infinity on the generic path.
