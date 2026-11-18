---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

Matrices with extreme entries now work in the `functions` kernels, in `lstsq` and in the `svd` family (Fixes #1122, #1124, #1129).

`qr`, `sqrtm`, `inv`, `rank` and `nullspace` of `functions` scale a matrix of plain numbers by an exact power of 2 when its largest entry is outside a window, as in #1104, and scale the result back. The window is 2^-400 to 2^400 for `inv`, 2^-20 to 2^400 for `qr`, `sqrtm`, `rank` and `nullspace`. A matrix inside its window takes the old path. The scale helpers (`withPow2Scale`, `entryRange`, `ldexp` and others) now live once in `@danielsimonjr/mathts-core/internal`, and `matrix` re-exports them from its `common.ts`. `eig` of `matrix` now uses the same helper in place of its own copy of the rule. Its results have the same bits on 5,716 matrices from 2^-1040 to 2^1010.

A differential against the build before this change ran each changed function on 1,800 ordinary matrices of size 1 to 6 (largest entry 1e-5 to 1e4: real, integer, rank-deficient, symmetric positive definite and 1 × 1; 1,297 square ones for `inv` and `sqrtm`). Every result has the same bits, for `qr`, `inv`, `sqrtm`, `rank`, `nullspace` and `pinv` of `functions` and for `lstsq`, `svd`, `singularValues`, `pinv`, `cond`, `norm2` and `lowRankApprox` of `matrix`.

A second corpus has 2,730 extreme matrices: 200 in each of 11 magnitude classes from 2^-1040 to 2^1010, 300 with one entry far below the largest (the span class), 200 graded diagonals from 1e-34 to 1e-4 and 30 special cases. Each changed result was judged against an 80-digit oracle (mpmath; NumPy 2.3.5 for `rank` and `pinv`). In the class 2^13 to 2^40 every result has the same bits.

| Function                                          | Changed values | Closer | Same error | Further             |
| ------------------------------------------------- | -------------- | ------ | ---------- | ------------------- |
| `qr`                                              | 1,481          | 1,304  | 168        | 9 (largest 1.5 eps) |
| `inv`                                             | 143            | 50     | 5          | 0                   |
| `sqrtm`                                           | 693            | 692    | 1          | 0                   |
| `rank`                                            | 1,280          | 1,280  | 0          | 0                   |
| `nullspace`                                       | 1,292          | 1,286  | 1          | 5 (less than 1 eps) |
| `pinv`                                            | 151            | 151    | 0          | 0                   |
| `norm2`                                           | 89             | 89     | 0          | 0                   |
| `lowRankApprox`                                   | 39             | 39     | 0          | 0                   |
| `svd`, `singularValues`, `cond`, `functions.pinv` | 12 to 13 each  | all    | 0          | 0                   |

Of the changed `inv` values, 87 more had a non-finite entry before and have one now, for matrices below 2^-1022: each ±Infinity entry is now where the true inverse is above the double range, and no entry is NaN. One more has an infinite input. The `svd` family changes only in the span class and the special cases, where the unscaled run is now judged (#1129). A result that changes between a value and an error:

- `inv`: 7 results were a matrix of NaN and are now the error "determinant is zero" (singular matrices above 2^400). 69 errors "determinant is zero" for matrices near 1e-200 and below are now values. 42 of them have ±Infinity entries, where the true inverse is above the double range.
- `sqrtm`: 303 values are now an error ("could not converge" for 291, "determinant is zero" for 12). Each of those values was wrong (a residual above 1e-10, or NaN). 81 errors are now values.

Known limits:

- `rank` and `nullspace` still change at the window edge 2^-20, because the absolute pivot test applies inside the window (#1157).
- `sqrtm` can throw between 2^70 and 2^400, because its absolute stop test cannot be met when one unit in the last place of the root is larger than 1e-6 (#1158).
- `qr` gives a different result for 101 random matrices with a largest entry below 2^-43. 61 of them differ only in the sign of a row of R.
- `inv` of a matrix whose entries span more than the double range can still return all zeros, as before: `inv([[1e300, 1e-300], [0, 1e300]])` (#1162).
- `sqrtm` of a singular matrix can return a wrong root with no error, at every scale (#1163). Such a matrix times 2^700 threw before and now returns that root, scaled.

- `qr([[3e200, 1e200], [4e200, 2e200]]).R` was NaN. It is now `[[5e200, 2.2e200], [0, 4e199]]` (NumPy gives the same up to the sign of the first row).
- `qr` of a matrix with entries below about 2^-51 returned the upper triangle of the input as R, because an absolute zero test skipped every reflection. `qr([[1.3, -0.4, 0.7], [0.2, 2.1, -1.1], [-0.9, 0.5, 1.6]] · 2^-60).R` is now 2^-60 times the R of the unscaled matrix. For a largest entry below 2^-43, a result that was a valid factorization can also change, most often in the sign of a row of R.
- `sqrtm([[4e200, 1e200], [1e200, 3e200]])` was NaN. It is now `[[1.98158e100, 2.70832e99], [2.70832e99, 1.71075e100]]`, as in SciPy. Above 2^400, the unscaled iteration is tried first and kept when it is finite. Else the matrix is scaled to a largest entry in [1, 4). A scaled run that is not finite throws "could not converge". Before, `sqrtm` of a well-conditioned 2×2 matrix times 2^450 threw "could not converge"; it is now 2^225 times the root of the unscaled matrix.
- `sqrtm([[4e-20, 1e-20], [1e-20, 3e-20]])` had a diagonal of 9.5e-7, because the stop test is absolute. It is now `1.98158e-10` and `1.71075e-10`, as in SciPy.
- `inv([[1e200, 1e200], [0, 2e200]])` was all 0. It is now `[[1e-200, -5e-201], [0, 5e-201]]`. `inv([[1e-200, 1e-200], [0, 2e-200]])` threw "determinant is zero". It is now `[[1e200, -5e199], [0, 5e199]]`, as in NumPy.
- `rank([[1e-20, 1e-20], [0, 2e-20]])` was 0 and `nullspace` was the identity. They are now 2 and `[]`, as in NumPy. An explicit `tol` is still an absolute pivot tolerance, so `rank(A, 1e-10)` of that matrix is still 0.

`lstsq` divided every entry of `b` by the largest one, so the small entries of an extreme `b` became 0 or lost bits. The solution is linear in `b`. When that division would push a nonzero entry below 2^-1022, `b` is now split into the entries that keep their bits and the entries that do not. Each part is solved at its own scale, and the two solutions are added. Any other `b` gives the same bits as before, except a `b` whose largest entry is below 2^-1022 times the largest entry of `A` (see below). `lstsq(I, [[1e200, 1e-200], [0, 1e-200]])` was `[[1e200, 0], [0, 0]]`. It is now `[[1e200, 1e-200], [0, 1e-200]]`, as in NumPy. `lstsq(I, [1e100, 1e-300])` was `[1e100, 0]`, and `lstsq(I, [3, 1e-310])` was `[3, 9.9999999999995e-311]`. They are now `[1e100, 1e-300]` and `[3, 1e-310]`. A subnormal `b` also keeps its bits when the largest entry of `A` is above 1: `lstsq([[9, -2], [0, 1]], [0, 1e-323])` was `[0, 0]` and is now `[0, 1e-323]`. On 400 right-hand sides of that kind with no wide span, 277 results are bit-equal, 123 change, and none is further from the exact solution.

A differential on 900 such right-hand sides (dense, identity, diagonal, triangular, block-diagonal, tall, wide and rank-deficient `A`, vector and matrix `b`) compared the result with the build before this change and with the exact rational solution. 587 results are bit-equal. An entry changes only where a small entry of `b` reaches it. Of the 306 changed results that have full rank, none is further from the exact solution relative to the largest entry of its column, and 25 are closer. Relative to each entry, 288 are closer and 1 is further, by 1.5 eps. The 7 changed rank-deficient results are closer to NumPy.

The `svd` family can keep an unscaled kernel run for a matrix whose entries span more than the double range. That run is now kept only when its singular values are finite and each one is within 1e-10 times the largest singular value of the scaled run. Before, a finite run was kept. `pinv([[1e200, 0, 0], [0, 1, 0], [0, 0, 1e-200]])` of `matrix` returned all zeros. It is now `diag(1e-200, 0, 0)`, as in NumPy. `singularValues([[0, 0, 0], [0, 2e87, 1e86], [1e64, 0, 1e-267]])` was `[2e87, 1e86, 1e64]`. It is now `[2.0024984394500785e87, 1e64, 0]`, as in NumPy.
