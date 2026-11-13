---
'@danielsimonjr/mathts-matrix': minor
---

`eig` returns `repeatedEigenvalues`, one entry per eigenvalue that occurs at least twice. Each entry gives the algebraic multiplicity, the count of independent eigenvectors (the nullity of `A - λI`), and whether the eigenvalue is defective. Eigenvalues are grouped by single linkage with a tolerance relative to the matrix norm, and the report is computed on first read, so `eig` and `eigvals` pay nothing for it. The field is additive: `values` and `vectors` are unchanged.
