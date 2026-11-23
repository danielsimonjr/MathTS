---
'@danielsimonjr/mathts-functions': patch
---

Control RK23 and RK45 error with the estimated local change in the state. For numeric states, `tol` now sets relative tolerance and `tol * 0.001` sets absolute tolerance. Step counts can differ from mathjs's absolute derivative controller. Unit-valued problems retain the previous tolerance convention.
