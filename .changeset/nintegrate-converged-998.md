---
'@danielsimonjr/mathts-functions': patch
---

`nintegrate` and `integrate(fn, a, b)` throw a `RangeError` when the integral does not converge or the result is not finite, instead of returning a wrong number. A NaN integrand, a caller-limited `maxDepth` that leaves unresolved error, and convergent `x^-p` on `[0, 1]` for `p` above about 0.67 at the default `maxDepth` now throw; a larger `maxDepth` resolves them. A NaN limit throws `a limit is NaN`. `QuadResult` gains `converged`; `quad`, `dblquad` and `tplquad` report it and never throw for convergence. `tanhSinh` reports `converged` too, and reports `false` for a NaN or infinite integrand. The `nintegrate` type is now `opts?: { tol, maxDepth }` in place of `tol?: number` (#998).
