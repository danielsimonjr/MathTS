---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': minor
---

`eigs` and `eig` of a number matrix keep a complex pair beside a huge entry. The matrix `eig` deflates a zero diagonal entry against its neighbouring sub-diagonal entries, not against the norm of the whole matrix, so `[[1e20, 0, 0], [0, 0, 1], [0, -1, 0]]` keeps the pair +-i. The matrix `eig` balances the matrix before the QR iteration (the new export `balanceForEig`: a permutation that isolates eigenvalues, then a scaling by powers of 2), so `[[3, 0, 0], [1e10, 0, 1], [0, -1, 0]]` gives 3 and +-i, not 52.9, -49.9 and -0.0011. The order of the values of `eig` can change for a matrix that the permutation reorders. The QR step no longer stops when its shift is exactly 0, so `eig([[3, 1e-8, 0], [1e-8, 0, 1], [0, -1, 0]])` converges. The test that reads an eigenvalue as real uses the Gershgorin rows of the balanced active block, so `1e-5 +- i` beside 1e20 stays complex, and a coupling entry of 1e15 does not make +-i real. (Refs #1240)
