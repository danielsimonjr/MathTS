---
'@danielsimonjr/mathts-functions': patch
---

`eigs` on a BigNumber or Complex cyclic permutation matrix converges, and the general solver no longer reads small entries as zero (Fixes #1202).

Result before this change, for the 3x3 cyclic permutation matrix times 2^e:

- BigNumber and Complex, e = 0, -20, 40: threw "The eigenvalues failed to converge".
- BigNumber and Complex, e = -40, -60: returned the eigenvalues 0, 0, 0.
- BigNumber and Complex eigenvectors: the same failures.
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

Routing change: with the default precision, or a precision given as a number, a BigNumber or Complex matrix whose pairs differed by 1e-14 to 1e-12 went to the general solver; it now goes to the symmetric solver when each pair differs by at most `precision` times its own size, as it already did for a precision given as a BigNumber. For `[[1,2],[2+1e-13,3]]` the eigenvalues move by 4.4e-14, and a Complex matrix whose imaginary parts are within `precision` of the entry sizes returns numbers, not Complex values.

Not fixed: a defective matrix with small entries still returns false eigenvectors (#1242), and a symmetric BigNumber matrix with small entries still returns its diagonal (#1243, `realSymmetric.ts`).
