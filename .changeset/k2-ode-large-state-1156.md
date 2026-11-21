---
'@danielsimonjr/mathts-functions': patch
---

`solveODE` with `RK23` or `RK45` on a very large BigNumber state stops with `step size underflow` and no longer runs to the attempt cap. A BigNumber step now stops below `10^(1 - precision)` times the larger of `|t|` and the span. When the last rejected error estimate is finite, the message names it and `tol`, says that the error test is absolute (as in mathjs) and advises `options.tol` or a rescaled state. `tol: Infinity` accepts the first trial. A BigNumber step is accepted by an exact decimal compare. The number path is unchanged: the same number of calls of `f`, and the same message base. `solveODESystem`, `solveDDE` and `solveDAE` start with a finite state of 1.4e154 or more: the norm of the first step no longer overflows. (Refs #1156)
