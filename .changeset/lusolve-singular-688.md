---
'@danielsimonjr/mathts-functions': minor
---

`lusolve` now throws when the LU factor is singular or non-finite, including consistent rank-deficient systems that previously returned a particular solution with free variables set to zero in `usolve`. The pivot floor is `1e-15` times the largest absolute entry (the same cutoff `linsolve` uses on a unit-scale matrix); numeric systems smaller than 1 are equilibrated so that floor stays relative to the matrix. Direct `usolve` still propagates NaN/±Infinity and still solves a tiny nonsingular triangle.
