---
'@danielsimonjr/mathts-matrix': minor
---

`eig` returns `repeatedEigenvalues`, one entry per eigenvalue that occurs at least twice. Each entry gives the algebraic multiplicity, the count of independent eigenvectors (the nullity of `A - λI`), and whether the eigenvalue is defective. The field is additive: `values` and `vectors` are unchanged.
