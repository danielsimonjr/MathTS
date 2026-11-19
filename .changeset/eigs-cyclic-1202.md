---
'@danielsimonjr/mathts-functions': patch
---

`eigs` on a BigNumber or Complex matrix works at every scale, and on a cyclic permutation matrix (Fixes #1202).

Result before this change, for the 3x3 cyclic permutation matrix times 2^e:

- BigNumber and Complex, e = 0, -20, 40: threw "The eigenvalues failed to converge".
- BigNumber and Complex, e = -40, -60: returned the eigenvalues 0, 0, 0.
- BigNumber eigenvectors: the same four failures.
- BigNumber `[[1, 2], [3, 4]]` times 2^-50: wrong eigenvalues.
- number matrix: correct (unchanged).

Result now: the eigenvalues are the cube roots of unity times 2^e, and `A v = lambda v` holds, at every scale above.

Causes: the QR iteration of `complexEigs` used the corner entry as the shift, and that shift is 0 for a cyclic matrix, so the matrix never changed. It now takes an exceptional shift every tenth step without convergence. The balance, Hessenberg, deflation, eigenvector and symmetry tests compared entries with absolute tolerances (and the fuzzy `equal`, `smaller` and `larger`, which treat a difference below `absTol` as zero). They now compare with `precision` times the largest entry of the matrix. The solvers for the eigenvectors work on the characteristic matrix divided by that scale.
