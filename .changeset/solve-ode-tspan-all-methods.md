---
'@danielsimonjr/mathts-functions': patch
---

`solveODE` checks `tspan` once, for every method (#991). Before this change, RK23 and RK45 checked the shape of `tspan`, but Rosenbrock, RODAS, BDF and Radau read only `tspan[0]` and `tspan[1]`. So `solveODE(f, [1, 0, 0], [0, 40], { method: 'Radau' })` hung. Now every method throws the RK45 text for a `tspan` that is not two numbers or two units. Every method also throws `"tspan" must contain finite numbers` for a NaN or Infinity entry. Before, a NaN entry returned a silent one-point result, and an Infinity entry ran into the step cap.

A NaN in `y0` or a NaN from `f` no longer hangs the loop. The run ends at the end of `tspan` with a NaN state, so the NaN propagates into the result. Before, RK23, RK45, Rosenbrock, RODAS, BDF and Radau spun until the attempt cap.
