---
'@danielsimonjr/mathts-functions': minor
---

**Breaking:** `solve` now rejects non-string (matrix) input with a `TypeError` naming `linsolve` instead of returning `[]`. Quadratics such as `x^2 - 2` return symbolic radical strings (e.g. `sqrt(2)`) rather than floating approximations.

**Breaking:** `evaluate('sum(i, 1, 3, i)')` (and similar four-argument indexed-sum misuse) now throws with guidance to use `summation`, instead of returning a complex variadic sum.

Unify `integrate('1/x')` and `symbolicIntegral('1/x')` on `log(abs(x))`. `casDerivative` delegates to `derivative`. `integrate(fn, a, b)` dispatches numeric quadrature via `quad`. Polynomial `simplify`/`factor` canonicalize perfect squares as `(x+1)^2`.
