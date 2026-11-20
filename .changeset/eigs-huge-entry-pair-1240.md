---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': patch
---

`eigs` and `eig` of a number matrix keep a complex pair beside a huge entry. The matrix `eig` deflates a zero diagonal entry against its neighbouring sub-diagonal entries, not against the norm of the whole matrix, so `[[1e20, 0, 0], [0, 0, 1], [0, -1, 0]]` keeps the pair +-i. The test that reads an eigenvalue as real uses the scale of the Gershgorin rows of that eigenvalue, so `1e-5 +- i` beside 1e20 stays complex. (Refs #1240)
