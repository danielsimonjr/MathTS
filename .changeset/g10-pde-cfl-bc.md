---
'@danielsimonjr/mathts-functions': minor
---

`solvePDE` now throws `RangeError` when the explicit-Euler CFL number `r = α Δt/Δx²` exceeds `0.5`, unless `{ allowUnstable: true }` is passed (previously returned a silently wrong field). `solveParabolicPDE` validates `bcLeft`/`bcRight` shape before integrating and throws `TypeError` when given a number instead of `{ type, value }` (previously hung in the BDF loop).
