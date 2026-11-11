---
'@danielsimonjr/mathts-functions': minor
---

`solvePDE` now throws `RangeError` when the explicit-Euler Fourier number `r = α Δt/Δx²` is outside the stable band `[0, 0.5]` (negative `α` included), unless `{ allowUnstable: true }` is passed. Non-finite `r` and non-finite `left`/`right` always throw. `solveParabolicPDE` validates Dirichlet/Neumann `{ type, value }` (number or `g(t)`) before integrating and rejects Robin, bare numbers, and non-finite coefficients or boundary samples so they cannot spin the BDF loop.
