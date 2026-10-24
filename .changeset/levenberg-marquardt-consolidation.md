---
'@danielsimonjr/mathts-functions': patch
---

`curvefit` now calls `levenbergMarquardt` and still returns `number[]` (same signature; it does not throw on the previous fixtures). Its λ schedule, Jacobian step (`1e-8` → `1e-7`), solver (`linsolve` → `inv`), and singular-only catch follow LM. Noise-free linear/exponential fixtures still recover the planted parameters; on a linear `y=2x+1` fit the new path is exact where the old path had a 1-ulp error. `levenbergMarquardt` itself keeps the same iterates (forward Jacobian `h=1e-7`, `pairwiseDot` cost). `svds` uses core `norm2` for overflow-safe normalization. No existing test expectation changed.
