---
'@danielsimonjr/mathts-functions': patch
---

The `solveODE` maxIter error for an explicit method (`RK23`, `RK45`) names the stiff methods `BDF`, `Radau`, `Rosenbrock` and `RODAS` as options, and no longer says the system is stiff. `sol.y[i]` is the state at `sol.t[i]`; the layout is documented and pinned. solveODESystem counts accepted steps as solveODE does: maxSteps equal to the steps a run needs succeeds, a rejected attempt does not use it, and its error names maxSteps and carries the stiffness hint. A NaN or infinite start throws a RangeError, and a right-hand side that turns non-finite ends in a step size underflow error.
