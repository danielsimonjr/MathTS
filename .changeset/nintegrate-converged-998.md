---
'@danielsimonjr/mathts-functions': patch
---

`nintegrate` and `integrate(fn, a, b)` throw a `RangeError` when the integral does not converge or the result is not finite, instead of returning a wrong number. A NaN integrand, a caller-limited `maxDepth` that leaves unresolved error, and convergent `x^-p` on `[0, 1]` for `p >= ~0.7` now throw. `QuadResult` gains `converged`; `quad`, `dblquad` and `tplquad` report it and never throw for convergence (#998).
