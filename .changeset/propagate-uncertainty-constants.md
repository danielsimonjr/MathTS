---
'@danielsimonjr/mathts-functions': patch
---

`propagateUncertainty` takes CODATA constants in `values`: the expression reads the SI magnitude of each constant, and its `.uncertainty` in SI is the sigma of that input. The central-difference step is `relativeStep * |x|` (`relativeStep` when `x` is 0), not a `1e-30` floor, so `planckTime` and `exp` at 0 give the right partial. A `Unit` passed as `values` throws a `TypeError` that names the expected shape (#910). The JSDoc of `evaluate` states which symbols (`G`, `hbar`, `c`, `h`) the default scope reads as units and which `{ physics: true }` binds as constants (#908, #909).
