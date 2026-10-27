---
'@danielsimonjr/mathts-functions': patch
---

Route `solveBVP`, stiff `solveODE`, and `solveDAE` finite-difference Jacobians through `numericJacobian` (`step` / `f0` options); use core `norm2` in `eigsh`, `fsolve`, and Krylov; use `pairwiseDot` (RSS) and `sumSquaredDeviations` (TSS: pairwise mean plus the `(Σd)²/n` correction) in `ols`. No changed test expectations on existing fixtures (new parity and oracle tests only). Refs #422.
