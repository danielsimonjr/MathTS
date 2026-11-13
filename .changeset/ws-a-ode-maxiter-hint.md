---
'@danielsimonjr/mathts-functions': patch
---

The `solveODE` maxIter error for an explicit method (`RK23`, `RK45`) names the stiff methods `BDF`, `Radau`, `Rosenbrock` and `RODAS` as options, and no longer says the system is stiff. `sol.y[i]` is the state at `sol.t[i]`; the layout is documented and pinned.
