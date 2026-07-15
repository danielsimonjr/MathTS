---
'@danielsimonjr/mathts-functions': minor
---

Add a stiff ODE solver: `solveODE(..., { method: 'Rosenbrock' })`

`solveODE` previously offered only explicit methods (RK23, RK45), which stall or blow up on **stiff**
systems — chemical kinetics, electrical circuits, control systems, reaction-diffusion — the backbone
of engineering/scientific modeling. Added the linearly-implicit **ode23s** method (Shampine &
Reichelt): 2nd-order, L-stable, with an embedded error estimate for adaptive stepping. It forms a
finite-difference Jacobian and one LU factorisation of `W = I − h·γ·J` per step (reused for its three
stage solves), so it takes steps at the slow time-scale where explicit methods would need vanishingly
small ones.

```ts
// Van der Pol at μ=1000 — explicit RK45 needs ~10⁶ steps; Rosenbrock handles it directly.
solveODE((t, y) => [y[1], 1000 * (1 - y[0] ** 2) * y[1] - y[0]], [0, 3000], [2, 0], {
  method: 'Rosenbrock',
  tol: 1e-6,
});
```

Verified against a linear stiff system's exact solution and against `scipy.integrate.solve_ivp`'s BDF
on stiff Van der Pol. Plain-number state only (the Jacobian and linear solve are numeric); RK23/RK45
remain the default for non-stiff problems.
