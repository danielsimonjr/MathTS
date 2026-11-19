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

Result now: a small block beside a huge entry keeps its own eigenvalues. For example, `[[1e20, 0, 0], [0, 1e-5, 1], [0, -1, 1e-5]]` as BigNumber or Complex gives `1e-5 + i`, `1e-5 - i` and `1e20`, and `A v = lambda v` holds.

Causes: the QR iteration of `complexEigs` used the corner entry as the shift, and that shift is 0 for a cyclic matrix, so the matrix never changed. It now takes an exceptional shift every tenth step without convergence. The balance, Hessenberg, deflation, eigenvector and symmetry tests compared entries with absolute tolerances (and the fuzzy `equal`, `smaller` and `larger`, which treat a difference below `absTol` as zero). Each test is now relative to the entries that it compares:

- symmetry: `|a_ij - a_ji| <= precision * max(|a_ij|, |a_ji|)` for each pair.
- real entries: `|im(a_ij)| <= precision * |a_ij|` for each entry.
- deflation: the LAPACK `dlahqr` test, relative to the two diagonal entries beside the subdiagonal entry.
- Hessenberg reduction: only a column of exact zeros skips the elimination.
- equal eigenvalues and the 2x2 Jordan blocks: relative to the values, and to the largest entry of the block.
- eigenvector solves: a diagonal entry is exact zero where it matches the eigenvalue, and each other row is divided by its diagonal entry.
