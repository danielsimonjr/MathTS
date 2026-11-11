---
'@danielsimonjr/mathts-functions': minor
---

Add `solveBoxLcp`, a dense box-constrained LCP solver by projected Gauss-Seidel (w = A x - b, lo <= x <= hi). It supports friction bounds coupled to another variable (`findex`, |x_j| <= mu x_i), warm start through an in/out `x`, over-relaxation, and a reusable result object, so a solver loop makes no allocation (issue 379).
