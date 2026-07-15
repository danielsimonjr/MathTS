---
'@danielsimonjr/mathts-functions': minor
---

Fix `solveODE` — the JS reference path was fully broken; add initial-step selection

`solveODE`'s JavaScript path threw `multiply(Array, Array) requires two 2-D matrices` on **every**
call: the adaptive Runge-Kutta step combined its stages with the mathjs form `multiply(h, a[i], k)`,
which relies on vector·matrix / vector·vector `multiply` semantics that MathTS's typed `multiply`
rejects for 1-D operands (it routes those to `dot`). It stayed green in CI only because the test
environment loads a WASM kernel that takes a different path — but **scalar ODEs** (a non-array `y0`)
and any consumer without the WASM binary loaded always hit the broken JS path.

The stage combinations are now computed term-by-term through the scalar-broadcasting `multiply`/`add`
(a new `stageCombo` helper), so scalar and vector states both work — verified against closed-form
solutions (`y'=-y → e⁻¹`, logistic, harmonic oscillator, backward integration) for both RK23 and RK45.

Also added a proper **initial-step heuristic** (`h₀ ≈ 0.01·‖y0‖/‖f(t0,y0)‖`, Hairer): the solver
previously used the whole time span as its first step, which could slip past an embedded error test
and silently accept a crude low-order result — RK23 on `y'=-y` returned `1/3` instead of `e⁻¹`. Both
methods are now robust from the first step without the caller supplying `firstStep`.
