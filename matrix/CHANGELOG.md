# @danielsimonjr/mathts-matrix

## 0.12.0

### Minor Changes

- d0a18ca: A matrix of a second copy of the matrix package works in every public function (#1041). New export: isNativeMatrix.
- 5ba5401: `eigs` lists one eigenvector for each independent direction of an eigenvalue (Fixes #926).
  
  - For `[[2,1,0],[0,2,0],[0,0,3]]`, `eigs` gave two parallel vectors for the eigenvalue 2. It now gives one, as its documentation says: an eigenvalue appears in `eigenvectors` as often as its geometric multiplicity. `values` still lists 2, 2, 3. `eigenvectors` is shorter than `values` for every defective input. A repeated eigenvalue that is not defective keeps all its vectors, and an input without a repeated eigenvalue keeps the same bits.
  - `eig` keeps one row of `vectors` for each eigenvalue, so its shape does not change. Each `repeatedEigenvalues` entry has a new field `indices`: the positions of its copies in `values`. The rows of a defective eigenvalue repeat a direction; the entry tells which rows.

### Patch Changes

- 6b4e603: A matrix with a very large or very small largest entry is now scaled by an exact power of 2 in `schur`, `qr`, `lq`, `rq`, `ql`, `qrPivoted`, `svd`, `singularValues`, `norm2`, `cond`, `pinv`, `lowRankApprox`, `sqrtm`, `logm` and `condest`, and the result is scaled back (Fixes #1104). `schur([[1, 1e160], [1e160, 1]])` returned NaN; its diagonal is now 1e160 and -1e160 to 15 digits, as in SciPy.
  
  Each routine has a window for the largest entry: 2^±128 for `schur`; 2^-400 to 2^128 for the `svd` family; 2^-20 to 2^128 for `logm`; 2^-20 to 2^400 for `qr`, `lq`, `rq`, `ql` and `sqrtm`; 2^±400 for `qrPivoted` and `condest`. A matrix inside its window takes the same path as before, with bit-identical results. One exception: `sqrtm` of a non-symmetric matrix with a largest entry above 2^256 now gets a scaled Schur step, so its result changes. A larger matrix is scaled to the top of the window. A smaller matrix is scaled to [1, 2).
  
  `logm` of a matrix with a largest entry above 2^128 can change from the 12th digit. Inside the window the absolute cutoffs still apply: `sqrtm` treats a matrix as symmetric when its entries differ by at most 1e-8. In a scaled `svd`, a singular value below about 2^-660 of the largest one can become 0: `svd(diag(1e200, 1, 1e-200))` returns `[1e200, 1, 0]`. When the scale would lose a nonzero entry and the unscaled result is finite, the unscaled result is kept. `logm` of a matrix with complex eigenvalues and a largest entry below 2^-20 now throws, as it already did for the same matrix at unit scale; before, it returned a value.
  
  `normFro`, `DenseMatrix.norm`, `SparseMatrix.norm` and `norm(A, 'fro')` of `[[1e200, 1e200]]` return `1.414e200` instead of `Infinity`, and the norm of a matrix of 1e-200 entries is no longer 0. `lstsq` no longer overflows or underflows when the scale of `b` is subnormal or very large.
- c5ea0d7: `eig` and `eigvals` scale the matrix by a power of 2 before the QR iteration, so a matrix with entries above about 1e154 or below about 1e-146 gives correct eigenvalues. Before, `eig([[1,1e154,0],[1e154,4,1e154],[0,1e154,9]])` and `mathieuA(3, 1e200)` never returned, a nonsymmetric matrix at that scale gave NaN, and a tiny matrix gave wrong values. A non-finite eigenvalue throws a RangeError ("eig: an eigenvalue is not finite"), and the QR iteration throws a RangeError ("eig: QR iteration did not converge") after `maxIterations` iterations for one eigenvalue (default 1000; the option was ignored before). `eigs` throws the RangeError of the native solver for a non-finite entry, where it returned NaN or never returned. Trade: the scaling brings the largest entry into range, so a value far below it can go to zero: `eigvals([[1e300,0],[0,1e-300]])` gives `[1e300, 0]`, not `[1e300, 1e-300]` (#989).
- db4818f: Fixes #1107: `eig` and `eigvals` at subnormal scale, and the `maxIterations` option.
  
  - The `isSymmetric` field of the `eig` result is now relative: `|a_ij - a_ji| / max|a| <= 1e-10`. The old test was absolute (`1e-10`), so the answer changed with the scale of the matrix. `eig([[1e-200,1e-200],[0,1e-200]])` reported `isSymmetric: true`, two independent eigenvectors in `repeatedEigenvalues` and `defective: false`. It now reports `isSymmetric: false`, one independent eigenvector and `defective: true`, as at scale 1. The flag changes for some matrices of ordinary scale: `max|a| = 1e6` with an asymmetry of `1e-6` is now symmetric, and `max|a| = 1e-6` with an asymmetry of `1e-11` is now not symmetric. The flag selects only the `repeatedEigenvalues` grouping; the values and vectors do not use it.
  - `repeatedEigenvalues` factors the matrix at the scale of the solver. Its `value` is scaled back to the scale of the input.
  - The Householder reduction applies each reflector to the eigenvector matrix as the reflector is formed, before its entries are scaled back. `eig([[1,4e-323,0],[4e-323,4,4e-323],[0,4e-323,9]])` gave `Infinity` and `NaN` in `vectors`, and a 4x4 matrix with entries of `1e-312` gave eigenvector errors near `1e-13`. Both now give unit vectors with errors near `1e-16`. Eigenvectors of other matrices can change in the last bits.
  - `eig` and `eigvals` throw a `RangeError` when `maxIterations` is not a positive integer or `Infinity` (`NaN`, `null`, `0`, a negative number, a fraction, a string). `NaN` switched the iteration limit off and `null` threw an unrelated error. `Infinity` still means no limit. An omitted `maxIterations` still means 1000.
- d297c16: Internal refactor, no change in behaviour (Refs #1212). The matrix `qr` and `qrPivoted` scale R back with the shared `scaleDense` helper in `operations/common.ts`, which the WASM backend also uses. The functions `qr` runs its number path and its Complex path through one scaled call.
- 1f8ff61: `eig(A).isSymmetric` is true only when every `|a_ij - a_ji|` is at most `8 * n * eps * ||A||_F`, so it is exact up to the rounding of the input and does not depend on the scale of `A`. The test was `|a_ij - a_ji| / max|a| <= 1e-10`, so `[[1, 1e-12], [0, 1]]` and any other matrix whose asymmetry was above `8 * n * eps * ||A||_F` but at most 1e-10 relative to `max|a|` reported `true`; they report `false` now. The flag does not choose a solver or change the eigenvalues, vectors or `repeatedEigenvalues`: the result is bit-equal to the former one apart from the flag (Fixes #1191).
- 24e06d4: `eig` and `eigvals` of a zero matrix (3x3 and larger) no longer throw `RangeError: eig: QR iteration did not converge`, and the eigenvectors of the 2x2 zero matrix are no longer NaN. The Hessenberg deflation test now accepts an exactly zero sub-diagonal when the norm is zero. A sub-diagonal entry exactly equal to `eps * s` now also deflates. For such an input the eigenvalues can differ in the last bits and in order, and the eigenvectors of a repeated eigenvalue can be a different valid set. For `[[1,0,0],[2^-51,1,0],[0,3,2]]` the eigenvalues change from `[0.9999999999999998, 2, 1]` to `[1, 1, 2]`; the residual stays at rounding level. Fixes #1192.
- f7a4aa7: Kernels of the matrix package no longer compare data to an absolute constant that depends on the unit of the matrix (Fixes #1123, #1125, #1127).
  
  Root causes and results (SciPy and NumPy 2.3.5 are the oracle):
  
  - `WASMBackend.qrDecomposition`, `luDecomposition` and `inverse` (JS and AssemblyScript paths) skipped a column or a pivot below an absolute 1e-14 and squared entries above 1e154. The three methods now run on a copy scaled by an exact power of 2 when the largest entry is outside [2^-3, 2^400]. `[[3e-100,1e-100],[4e-100,2e-100]]` gave `Q = I, R = A` and `singular: true`; it now gives `|R| = [[5, 2.2], [0, 0.4]]e-100`, a regular LU and `inverse = [[1e100, -5e99], [-2e100, 1.5e100]]`. `[[3e200,1e200],[4e200,2e200]]` gave `Q·R ≠ A`; it now gives `Qᵀ·R = A` to 1e-16. The window constant is `UNIT_LO` in `core/src/pow2-scale.ts`; the scaling uses the shared `withPow2Scale`.
  - The JS path of `WASMBackend.luDecomposition` and `inverse` did not test the last pivot. `[[1,2],[2,4]]` gave `singular: false` and an inverse of NaN entries. The JS path now reports `singular: true` and a zero inverse when the last pivot is below 1e-14, as the AssemblyScript path does. `[[1,0],[0,1e-15]]` is now singular on both paths (it was regular on the JS path). The absolute 1e-14 pivot floor inside the scaling window is #1172.
  - `matrixSqrtm` compared with an absolute 1e-8 (symmetry, negative eigenvalue of a symmetric matrix), 1e-7 (negative or complex eigenvalue of a non-symmetric matrix) and 1e-13 (Newton step). Below a largest entry of 1 each cutoff is now relative to that entry. The eigenvalue tolerance is also never below 1e-13 of the largest entry, so it grows above a largest entry of 1e5 (symmetric) and 1e6 (non-symmetric): the rounding noise of a zero eigenvalue is no longer read as a negative eigenvalue. The 2×2 block root test and the Newton residual test are the tests of the previous release. `matrixSqrtm([[4,1],[1.02,3]]·2^-22)` gave a symmetric matrix with off-diagonal 1.3359e-4; it now gives 1.3227e-4 and 1.3492e-4 (SciPy). `matrixSqrtm(zeros(2))` gave `5.684e-14·I`; it now gives zeros (SciPy).
  - `matrixSqrtm` of a non-symmetric matrix was wrong from about 2^40 (#1127). The Schur form keeps Hessenberg residue below its quasi-diagonal of up to 1e-12 of the neighbouring diagonal, and the absolute test `|T[i+1][i]| < 1e-12` read residue of a large matrix as a 2×2 block. The test is now relative to the neighbouring diagonal. For G·2^52 the error of the root, scaled back, was 0.0122; it is now 0 (equal to `sqrtm(G)`), and G·2^300 gave NaN and now gives the root.
  - `matrixLogm` rejected an eigenvalue at or below an absolute 1e-14. The Schur path now accepts a positive eigenvalue at or below 1e-14 only when it is 1e8 times above the backward error `max|A - Q·T·Qᵀ|` of the Schur form, so its logarithm has a relative error of at most 1e-8. `matrixLogm(diag(1, 1e-20))` threw `non-positive eigenvalue`; it now gives `diag(0, -46.0517)` (SciPy). `matrixLogm([[1e-20,1],[0,1]])` threw; it now gives `[[-46.05, 46.05], [0, 0]]` (SciPy). The Schur block test and the root denominator test are relative the same way.
  - `matrixLogm` used 16-point Gauss-Legendre constants with nodes wrong by up to 1e-8 and weights that summed to 1 - 1e-11, so each Schur-path logarithm had an error of about 1e-11. The constants are now correct to the last bit. `matrixLogm([[2,1,0],[1,3,1],[0,1,4]])` was 3.1e-12 from mpmath; it is now 1.6e-15.
  - For a large matrix whose Schur form keeps residue above an absolute 1e-12 (the previous release took the Newton path), `matrixLogm` runs both paths and keeps the Newton result only when it agrees with the Schur result to 1e-8. The Newton path is more accurate there when it converges, and wrong by up to 1e11 when it does not.
  - `qr` treated a column of residual norm below an absolute 1e-14 as dependent. The cutoff is now relative to the largest entry when that entry is below 1. A 3-column matrix of pivots 1.6e-15 and 1.3e-15 at 2^-19 kept its column in the NumPy values.
  
  Known limit: `matrixLogm` of a singular matrix of large entries returns a finite matrix instead of throwing (#1174). This is also the behaviour of the previous release.
  
  Value and throw changes:
  
  - `WASMBackend.luDecomposition` and `inverse`, JS path: 217 of 1,500 ordinary matrices change from `singular: false` to `singular: true` with a zero inverse. Each of the 217 has a reciprocal condition number below 1e-13 (largest 8.7e-15). Of 320 scaled matrices, 26 change to singular (reciprocal condition number below 1.2e-15) and 13 change from singular to regular.
  - `WASMBackend.luDecomposition` and `inverse`, AssemblyScript path: 17 of 320 scaled matrices change from singular to regular. No ordinary matrix changes.
  - `matrixSqrtm`, largest entry below 1: 10 non-symmetric matrices with a small negative eigenvalue (8 of 1,500 ordinary, 2 of 320 scaled) now throw `negative eigenvalue`. The previous release returned a real matrix with an error of 4e-4 to 4e-3; SciPy gives a complex root.
  - `matrixSqrtm`, largest entry above 1e5: 5 of 320 scaled symmetric matrices that threw `negative eigenvalue` now return the real root. The error against the SciPy root is 4e-9 to 1.1e-8.
  - `matrixLogm([[1e-20,1],[0,1]])` and `matrixLogm(diag(1, 1e-20))` return a value instead of throwing.
  
  Differential against the previous release (1,500 ordinary matrices of size 1 to 6, entries up to 1e6; 320 of them scaled by 2^-60 to 2^600). Equal means the same doubles.
  
  | function                                   | ordinary                                                             | scaled                                                                            |
  | ------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
  | `matrixSqrtm`                              | 1,488 equal; 8 value to throw; 4 symmetric closer (5e-13 to 1.2e-15) | 306 equal; 5 throw to value; 2 value to throw; 7 last-bit or closer               |
  | `matrixLogm`                               | 749 equal; 741 closer; 10 further, at most 2.1 times                 | 145 equal; 169 closer (1 was wrong by 2.6e10); 6 further, at most 2.1 times       |
  | `qr`                                       | 1,499 equal; 1 changed, equal error (largest entry below 1, graded)  | 320 equal                                                                         |
  | `WASMBackend` `qr` (AS and JS)             | 1,499 equal; the same 1 changed, equal error                         | 287 equal; 29 closer; 4 equal error                                               |
  | `WASMBackend` `luDecomposition`, `inverse` | AS 1,500 equal; JS 1,283 equal, 217 regular to singular              | AS 303 equal, 17 singular to regular; JS 281 equal, 26 to singular, 13 to regular |
- b473e94: `eigs` returns the eigenvector of a complex eigenvalue as `Complex` entries, so that `A v = lambda v` holds. Before, the vector held only the real part and was wrong (Fixes #978). When one eigenvalue is complex, every eigenvector holds `Complex` entries, as in mathjs; the vector of a real eigenvalue then has zero imaginary parts. A real spectrum keeps `number[]` vectors. The doc comment of `eig` now says that `vectors[k]` is a row, not a column.
  
  Value change: `eigs(A).eigenvectors[k].vector` is `Complex[]` for every `k` when any eigenvalue is a `Complex`.
- 2771df1: Matrices with extreme entries now work in the `functions` kernels, in `lstsq` and in the `svd` family (Fixes #1122, #1124, #1129).
  
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
- 852f6e2: Four small numeric defects.
  
  - A number as the data argument of a stable reduction in core (`pairwiseSum`, `pairwiseDot`, `sumSquaredDeviations`, their `Checked` variants, `neumaierSum`, `neumaierCumsum`, `norm2`, `scaledDistance`, `extrema`) now throws a `TypeError` that names the function. A string, and an object whose `length` is not a non-negative integer, throw the same error. Before, `pairwiseSum(0)` and `sumSquaredDeviations(0)` threw `RangeError: Maximum call stack size exceeded`, and `norm2(5)` gave `0` (#1011).
  - `numberVector` rejects a value that is not an array, typed array, array-like or iterable object. The statistics, signal and linear-algebra functions that take a number vector read a number as `[]`. Before, `zscore(5)` was `[]`, `skewness(5)` was `NaN`, `trapz(5)` was `0` and `signTest(5)` was `{ statistic: 0, pValue: 1 }`. Now each throws a `TypeError` that names the function, for example `zscore: expects an array of numbers, got a number` (#1083).
  - The SVD gave wrong singular values for a matrix whose leading column entry is negative with zeros below it, because the Householder helper returned the non-orthogonal `beta = -2` for that column. Before, `norm([[-3,0],[0,1]], 2)` was `9`, and the singular values were `[9, 1]`. Now the norm is `3` and the singular values are `[3, 1]` (NumPy and mathjs). `pinv`, `lowRankApprox` and `svd` rebuild such a matrix correctly. The default `norm` of a matrix was already the spectral norm (`p = 2`), as in mathjs. A new test pins that default, and the fix above corrects its value for such a matrix: `norm([[-3,0],[0,1]])` was `9` and is `3`. `norm([[1,0],[0,2]])` is `2` (#1082, #995).
  - In `parallel`, `parallelMean`, `parallelVariance` and `parallelStd` on the sequential path pass the data to `pairwiseSum` before they read its length. A number now throws the `TypeError` of core. Before, `parallelMean(1)` gave `0` (#1011).
- 6bc82a2: `eig(A).repeatedEigenvalues` counts a defective eigenvalue as defective when its coupling is below `sqrt(eps) * ||A||_F` (Fixes #1180). The rank tolerance of a cluster was fixed at `sqrt(eps) * ||A||_F`. It is now 4 times the measured cluster radius, between `8 * n * eps * ||A||_F` and the old `sqrt(eps) * ||A||_F`. A singular value above that tolerance counts as a coupling only when it is at least 16 times the largest one below it. Without that second test, rounding noise in a matrix such as `S * (2I) * S^-1` with a graded `S` was reported as a coupling. Value change: `[[1,1e-9],[0,1]]` and `[[1,1e-12],[0,1]]` report 1 independent eigenvector (were 2), and `[[1,1e-9,0],[0,1,0],[0,0,1]]` reports 2 of 3 (was 3). The report no longer reads the `isSymmetric` flag. It treats the matrix as symmetric when every `|a_ij - a_ji|` is at most `8 * n * eps * ||A||_F` (the flag has a looser tolerance, see #1191). A coupling below `8 * n * eps * ||A||_F` (about 6e-15 for a 2 x 2 matrix with unit entries) still counts as zero.
- Updated dependencies [fe2cf32]
- Updated dependencies [b1977e7]
- Updated dependencies [98a54f8]
- Updated dependencies [fbc5277]
- Updated dependencies [4304ad1]
- Updated dependencies [98a54f8]
- Updated dependencies [f7a4aa7]
- Updated dependencies [c4ddb8c]
- Updated dependencies [1629b29]
- Updated dependencies [2771df1]
- Updated dependencies [852f6e2]
- Updated dependencies [9a720bf]
- Updated dependencies [1906ed4]
- Updated dependencies [a5a8eff]
- Updated dependencies [aa18779]
- Updated dependencies [3929108]
- Updated dependencies [404e8a4]
- Updated dependencies [db3f34f]
  - @danielsimonjr/mathts-core@0.29.0
  - @danielsimonjr/mathts-parallel@0.12.0

## 0.11.0

### Minor Changes

- 9188123: `eig().repeatedEigenvalues` finds Jordan blocks of size 3 and more: a cluster of `m` eigenvalues links up to `2 * eps^(1/m) * ||A||_F` and is accepted when an orthogonal staircase of column-pivoted QR factorizations counts the multiplicity `m`. Distinct eigenvalues at the same spacing are not grouped.
  
  Breaking: `eig` and `eigvals` throw a `RangeError` on `NaN` or infinite input. Previously they returned `null` eigenvalues.
  
  `eig`, `svd`, `qr`, `cholesky`, `lu`, `lstsq` and `condest` accept a `SparseMatrix` from a second loaded copy of the package, and the element limit of `densifyForSolver` applies to them. `lsolve`, `usolve`, `lsolveAll`, `usolveAll` and `lusolve` accept a matrix-package `SparseMatrix` as the right-hand side.
- 9188123: `@danielsimonjr/mathts-linalg` exports `DenseMatrix`. `lstsq(A, b)` is a new export of matrix, linalg and functions: the column-pivoted Householder QR least-squares solution of `A x ≈ b`. It accepts any shape and a vector or matrix `b`, and returns the minimum-norm solution for rank-deficient or wide input, as NumPy does. The rectangular `lsolve` error names `lstsq`.
- 799b0fe: Compat output matches mathjs for `toString` and scalar trig (#889, #891, #892, #737).
  
  Breaking, visible output changes:
  
  - `Fraction#toString` prints the repeating decimal (`1/3` is now `0.(3)`, `1/2` is `0.5`). `format()` still prints the ratio (`1/3`), and a whole value prints without a denominator (`format(fraction(4, 2))` is `2`, not `2/1`).
  - `Matrix#toString` (matrix package, and the compat dense and sparse matrices) prints the nested-array form through `format()`: `[[1, 2], [3, 4]]` for 2-D, nested brackets for 3-D and more. Entries use `format()`: a Fraction entry prints `1/3` and a string entry prints quoted. The sparse matrix no longer prints the `Sparse Matrix [n x m]` listing from `toString`.
  - `Complex#toString` prints `NaN` when a part is NaN and `Infinity` when a part is infinite, as mathjs does (`log(-Infinity)` prints `Infinity`).
  - The compat instance type has no string index signature: `MathInstance` is the functions namespace plus the compat members. Code that read `math[name]` as `unknown` needs a cast.
  
  Workbook cells keep the ratio form for a Fraction result (`1/3`).
  
  Compat scalar `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `abs`, `exp` and `log` take a number fast path.
  
  Documented exception: `asin(NaN)`, `acos(NaN)` and `log(NaN)` return a real `NaN` (mathjs returns Complex `NaN`); the printed text is the same.
- 9188123: `eig` returns `repeatedEigenvalues`, one entry per eigenvalue that occurs at least twice. Each entry gives the algebraic multiplicity, the count of independent eigenvectors (the nullity of `A - λI`), and whether the eigenvalue is defective. Eigenvalues are grouped by single linkage with a tolerance relative to the matrix norm that grows with the size of the group, and the report is computed on first read, so `eig` and `eigvals` pay nothing for it. The field is additive: `values` and `vectors` are unchanged.
- b95de8a: **Breaking:** Node 20 is dropped (`engines.node` >=22.12); packed-consumer contract (#886, #888, #890, #893, #905, #912, #914, #916, #930).
  
  Every package sets `engines.node` to `>=22.12`, and CI tests 22.x and 24.x.
  
  Every `exports` entry gains a `default` condition equal to `import`, so `require()` of the ES build works at run time on Node >= 22.12 (`mathts-wasm` has top-level await and stays import-only). Node 22.12 prints an `ExperimentalWarning` for it; 22.13 and later do not. On Node 22.11 and earlier, `require()` reports `ERR_REQUIRE_ESM`; use `import()`. TypeScript accepts the `require()` of these packages from CommonJS under `moduleResolution: nodenext`; `node16` reports TS1471. Issue #736 closed docs-only because its acceptance allowed documenting ESM-only; the `default` condition is the `require(esm)` fix.
  
  Published `.d.ts` files name no Node, workerpool, DOM or WebGPU global, so strict `tsc` with no `@types/node` passes. The `mathts-gpu` handle types are the WebGPU global types when the consumer has them, and interfaces of the package when it has not. `mathts-workerpool` ships a `browser` build (the worker is one classic script), so a bundler pulls no Node builtin into `mathts-compat`. README code fences carry a runtime tag. `functions/evaluate` is not a size saving; use `mathts-expression` for a small bundle.
- 9188123: `linsolve`, `lsolve` and `lu` / `luSolve` accept a `SparseMatrix` from `@danielsimonjr/mathts-matrix`. The sparse input is densified with `toDense()` before the solve; `usolve`, `lsolveAll` and `usolveAll` do the same. `densifyForSolver(input, { maxElements })` is the one helper behind them: it tests the input by shape, so it works with a second copy of the matrix package, and it throws a `RangeError` above `maxElements` (default 4096 x 4096). The shared decomposition input also accepts a `SparseMatrix`, so `qr`, `eig`, `svd` and `cholesky` densify it too. Previously these threw `Cannot read properties of undefined (reading 'length')`, `m.size is not a function` or a shape error.

### Patch Changes

- a66847e: `DenseMatrix.toArray()` copies each row straight from the storage. It no longer calls `get()` and its bounds check for every entry, and it honours the offset and the row stride of a view. `lusolve` on nested input reads the packed U factor with one `toFloat64Array()` copy. It no longer builds a nested copy of U, and it returns the n×1 column without a matrix wrapper.
- e6a651b: `svd`, `pinv`, `lowRankApprox`, `normFro`, `qrPivoted` and `matrixSchur` read a `DenseMatrix` from its storage instead of calling `toArray()` first. Results are bit-identical to the nested-array input.
- Updated dependencies [3e0fb02]
- Updated dependencies [2635bbb]
- Updated dependencies [aa76758]
- Updated dependencies [799b0fe]
- Updated dependencies [b95de8a]
  - @danielsimonjr/mathts-parallel@0.11.0
  - @danielsimonjr/mathts-core@0.28.0
  - @danielsimonjr/mathts-gpu@0.4.0

## 0.10.1

### Patch Changes

- adcebad: Packaging (G27): neutral esbuild bundles no longer resolve Node builtins (workerpool requires are indirect; natural sort is in-repo ESM). `@danielsimonjr/mathts-functions/evaluate` is the same safe evaluate as the root and a smaller bundle. Safe evaluate keeps parse, typed, createUnit, resolve, simplify, derivative, and node constructors unreachable. ESM-only migration note, GitHub blob URLs in package READMEs, and a deterministic README stats check.
- 43e2715: G26 dogfood: faster number sort/median, blocked GEMM, packed `lusolve`, compat scalar fast path, wasm sin policy band, SVD README note.
- 72df4ec: DenseMatrix: preflight `DENSE_MATRIX_MAX_ELEMENTS` (1e8), nested-array constructor, and scalar `.multiply(k)` matching mathjs.
- a07bf29: Packaging P2 (dogfood G29): ship LICENSE in tarballs, homepage/bugs links, `exports['./package.json']`, honest `sideEffects`, JS source maps from tsdown, and workerpool types that typecheck without `@types/node` (via updated `@danielsimonjr/workerpool` patch).
- 93c6e56: Normalize decomposition inputs: `svd`, `lu`, `qr`, `cholesky`, `eig`, and `matrixSchur` accept `DenseMatrix`, nested arrays, square `Float64Array`, and `{ data, rows, cols }`; ragged and unknown inputs throw `TypeError`. `lusolve` accepts square packed `Float64Array` and that descriptor, and still accepts an `{ L, U, p }` decomposition.
- Updated dependencies [ef236dc]
- Updated dependencies [adcebad]
- Updated dependencies [ea94cc4]
- Updated dependencies [e4900c1]
- Updated dependencies [17f64da]
- Updated dependencies [8d727a1]
- Updated dependencies [b5f036d]
- Updated dependencies [7247de3]
- Updated dependencies [e7939a7]
- Updated dependencies [a07bf29]
- Updated dependencies [ca97716]
  - @danielsimonjr/mathts-core@0.27.0
  - @danielsimonjr/mathts-parallel@0.10.1
  - @danielsimonjr/mathts-gpu@0.3.0

## 0.10.0

### Minor Changes

- 2f73d66: Add a deterministic mode (issue 380). `setDeterministic(true)` from `@danielsimonjr/mathts-core` (or `config({ deterministic: true })` from functions) makes results bit-identical whether or not the WASM tier is loaded: only the WASM kernels measured bit-identical to JS (`abs` on a `Float64Array`) still run, and implicit WebGPU, worker-pool parallelism, the integration and sampling fan-outs, and the WASM matrix backend are skipped. See `docs/determinism.md`.

### Patch Changes

- Updated dependencies [2f73d66]
  - @danielsimonjr/mathts-core@0.26.0
  - @danielsimonjr/mathts-parallel@0.10.0

## 0.9.6

### Patch Changes

- 2b8dc33: Add or correct the doc comments of exported symbols, so the published declarations describe them. `create` in compat now carries its own doc comment. The change is to comments only: the emitted JavaScript is unchanged.

## 0.9.5

### Patch Changes

- Updated dependencies [2c631ff]
- Updated dependencies [2c631ff]
  - @danielsimonjr/mathts-parallel@0.9.0

## 0.9.4

### Patch Changes

- Updated dependencies [42f3c97]
  - @danielsimonjr/mathts-core@0.25.0
  - @danielsimonjr/mathts-parallel@0.8.4

## 0.9.3

### Patch Changes

- Updated dependencies [e7a003e]
  - @danielsimonjr/mathts-core@0.24.0
  - @danielsimonjr/mathts-parallel@0.8.3

## 0.9.2

### Patch Changes

- Updated dependencies [3628d5a]
  - @danielsimonjr/mathts-core@0.23.0
  - @danielsimonjr/mathts-parallel@0.8.2

## 0.9.1

### Patch Changes

- Updated dependencies [09b4dde]
- Updated dependencies [ac4212b]
- Updated dependencies [2a6c91d]
- Updated dependencies [0de3d7a]
- Updated dependencies [2fd73e8]
  - @danielsimonjr/mathts-core@0.22.0
  - @danielsimonjr/mathts-parallel@0.8.1

## 0.9.0

### Minor Changes

- 78f8a1c: Fix `DenseMatrix.diagonal(k)` length on non-square matrices (it now matches `SparseMatrix.diagonal`). `DenseMatrix` and `SparseMatrix` constructors reject non-integer dimensions, unsupported data types, out-of-range column indices and non-monotonic row pointers; `SparseMatrix.validate` runs the full CSR check. `SparseMatrix.fromCOO` bounds-checks indices and sums duplicate entries. `SparseMatrix.transpose` is a counting-sort CSR transpose. `DenseMatrix.toSparse` no longer relies on `require`. `JSBackend` element-wise, transpose, sum and dot kernels, the dense reductions and the `lu`, WASM and GPU result paths work on flat storage without per-element `get()` calls or extra copies.

### Patch Changes

- Updated dependencies [78f8a1c]
- Updated dependencies [78f8a1c]
  - @danielsimonjr/mathts-core@0.21.1
  - @danielsimonjr/mathts-parallel@0.8.0

## 0.8.1

### Patch Changes

- Updated dependencies [3652c57]
  - @danielsimonjr/mathts-core@0.21.0
  - @danielsimonjr/mathts-parallel@0.7.1

## 0.8.0

### Minor Changes

- 156e4ea: Share one implementation where two functions already ran the same algorithm: Gauss–Jordan solve (`matInv` and the matrix square-root column solver), scalar central differences (`bfgs` and `gradientDescent`), matrix rank, combination-index generation, cumulative max/min, the upper-gamma continued fraction, and chunk assembly.
  
  New public exports: `gaussJordanSolve` (matrix), `centralDifferenceGradient` and `upperGammaQ` (functions). `gaussJordanSolve` reads a missing right-hand-side entry as 0, where the old square-root column solver produced NaN. Other public names and their numeric results stay the same.
- fc6c32b: Export `matMul` for dense `number[][]` matrix products and route internal `functions` call sites through it instead of local copies.

### Patch Changes

- 45d691e: Remove the unreachable matrix WASM FFT JS bridge (`fft-wasm.ts`); public FFT remains in `@danielsimonjr/mathts-functions`.
- cbabf22: Consolidate ParallelBackend sequential fallbacks (divide via parallelBinary, dot via jsBackend, whenParallel for scale/multiply/transpose/sum). Sparse Hadamard stays an inlined CSR walk (mapNonZeros was >10% slower at 2000×2000 nnz≈40k).
- c7ef24d: Consolidate duplicate AssemblyScript typed-array header allocation (`allocHeader` / `makeAs`) into `wasm/as-typed-array.ts` per clone sprint batch D (M7).
- 8ed70e9: Sprint 2R: deduplicate matrix backend helpers and shared decomposition utilities (transpose re-export, `matInv`, `ParallelBackend` element-wise/sumAxis delegation, `JSBackend.norm` → reduction).
- 83d8074: Extract shared `WasmModuleLoader` base (`load` / cached `loadModule` / `getImports`) from the byte-identical copies in `functions` and `matrix` into `core/src/wasm-loader.ts` (`/internal` only). SHA-384 verification stays in each package's Node/browser load paths.
- 2fd47ee: Phase 6 P6-9: shared `allocAsHeader` on core `/internal` (clone reduction).
- 0400aa1: Sprint 2R: deduplicate matrix WASM allocation helpers (`allocHeader`, `allocateAs`/`makeAs`) and parallel dense-matrix pair dispatch (`densePair` for add/subtract/hadamard/divide). Public behavior unchanged; AS Int32 type id 4 vs 6 stays file-local.
- 8b0192c: Propagate 0×Infinity and 0×NaN through DenseMatrix.multiply.
- f5ffe00: Consolidate duplicate matrix operation helpers (Givens rotation, Schur QR chase, Gauss–Jordan continue-on-tiny-pivot, Newton sqrt update) per clone batch A.
- bc74de0: Unify matrix backend thresholds in `DEFAULT_CONFIG` (`multiply` WASM 256, `gpu.enabled` false) and derive `DEFAULT_EXTENDED_HINTS` from that table so `setConfig` cannot restore stale multiply threshold 500. Public `DenseMatrix.multiply` and `lu`/`qr`/`cholesky` remain JavaScript; WASM GEMM stays on `backendManager` / `Tensor.matMul`.
  
  **Tests:** `matrix/tests/config.test.ts` — `getRecommendedBackend(200000)` now `'wasm'` (oracle: `gpu.enabled` false and no GPU backend registered); GPU element threshold expects `DEFAULT_BACKEND_HINTS.gpuThreshold` instead of 100000; added `getRecommendedBackend(300, 'multiply') === 'wasm'` so 500 cannot creep back.
  
  **Expectation changes (independent oracle cited in test):**
  
  - `config.test.ts` GPU threshold: `DEFAULT_BACKEND_HINTS.gpuThreshold` (65536), not legacy 100000.
  - `config.test.ts` large-data recommendation: `'wasm'`, not `'gpu'` — registry has no GPU backend.
  
  Fixes #424.
- 0c02ffe: Performance: `JSBackend.multiply` uses flat row-major storage (P7-8).
- 2fd47ee: Phase 6 P6-10: consolidate WASM load paths on `WasmModuleLoader` (clone reduction).
- 67406a8: Sprint 2R near-clone batch 3: `runShader` for GPUBackend add/matmul/transpose, `gpuOrJs` for GPUMatrixBackend async ops, shared `applyGivensCols` for Schur/SVD.
- 974167d: Share dense matrix flip axis helper (clones plan PR-G).
- Updated dependencies [156e4ea]
- Updated dependencies [9f5a065]
- Updated dependencies [83d8074]
- Updated dependencies [d7daec0]
- Updated dependencies [7e71f31]
- Updated dependencies [e591145]
- Updated dependencies [19c4ba7]
- Updated dependencies [11c4559]
- Updated dependencies [a6cf17a]
- Updated dependencies [2fd47ee]
- Updated dependencies [9009676]
- Updated dependencies [b1bdef8]
- Updated dependencies [b2a24a0]
- Updated dependencies [1f52df2]
- Updated dependencies [2fd47ee]
- Updated dependencies [55f6b3a]
- Updated dependencies [58a5ec7]
  - @danielsimonjr/mathts-parallel@0.7.0
  - @danielsimonjr/mathts-core@0.20.0

## 0.7.9

### Patch Changes

- Updated dependencies [61426de]
  - @danielsimonjr/mathts-core@0.19.0
  - @danielsimonjr/mathts-parallel@0.6.11

## 0.7.8

### Patch Changes

- Updated dependencies [15adc89]
  - @danielsimonjr/mathts-core@0.18.0
  - @danielsimonjr/mathts-parallel@0.6.10

## 0.7.7

### Patch Changes

- Updated dependencies [f31f5ee]
  - @danielsimonjr/mathts-core@0.17.0
  - @danielsimonjr/mathts-parallel@0.6.9

## 0.7.6

### Patch Changes

- Updated dependencies [5b7ca6d]
  - @danielsimonjr/mathts-core@0.16.0
  - @danielsimonjr/mathts-parallel@0.6.8

## 0.7.5

### Patch Changes

- 8b0f960: WASM decompositions no longer grow memory on every call. The AS binary's stub runtime never frees, and although the backend pools its input and output buffers, the kernels allocated their own scratch and LU's permutation buffer was not pooled. Over 300 calls on a 64×64 matrix, memory grew by 16 MiB for LU, 0.9 MiB for inverse, 0.4 MiB for QR and 0.1 MiB for the determinant. The backend now passes scratch buffers to the rebuilt kernels (QR's Householder vector, and inverse's permutation in `work`) and pools the permutation buffer. A regression test runs 3,000 calls of each operation and requires zero growth. Results are unchanged.
- 8b0f960: The WASM allocation pool now recycles released blocks, so WebAssembly linear memory stays bounded. Allocations were never recorded in the pool, so nothing was reused, and the AssemblyScript binary's `--runtime stub` never frees memory: 5,000 allocate/release cycles grew it from 256 KiB to 128 MiB. A recycled block has its header `byteLength` rewritten to the requested size (kernels read their length from it), and `allocateFloat64ArrayEmpty` / `allocateInt32ArrayEmpty` zero-fill a reused block, as documented.
- 8b0f960: A failed WASM load no longer disables WASM for the rest of the process. Both loaders cached the in-flight load promise and never cleared it, so one bad path or transient fetch error made every later `load()` return the same rejection. It is now cleared however the load settles, and a failed load also drops the compiled module: a binary that compiled but failed to instantiate used to stay cached, so every later `load()` instantiated it again instead of reading the binary it was given.
- Updated dependencies [8b0f960]
- Updated dependencies [8b0f960]
  - @danielsimonjr/mathts-core@0.15.5
  - @danielsimonjr/mathts-parallel@0.6.7

## 0.7.4

### Patch Changes

- a13ce7e: The published `.d.ts` files now carry explicit `.js` extensions on relative imports, so a consumer on `moduleResolution` `node16` or `nodenext` can use them.
  
  Declaration emit runs under `module`/`moduleResolution` `nodenext` (`tsconfig.dts.base.json`). `tsc` copies a relative specifier into the `.d.ts` verbatim and synthesises one for an inferred type, so the emit mode is what decides whether the extension is there. An extensionless relative import in `src` is now a build error instead of a silent consumer break. A NodeNext consumer type check of the packed tarballs reported 60 errors before this change (53 TS2834, 7 TS2709) and reports 0 after it.
  
  `@danielsimonjr/mathts-functions` also imports `Decimal` and `Complex` as named exports of `decimal.js` and `complex.js`. NodeNext resolves those two packages as CommonJS, where the default export is a namespace and not usable as a type (TS2709).
- Updated dependencies [a13ce7e]
  - @danielsimonjr/mathts-core@0.15.4
  - @danielsimonjr/mathts-gpu@0.2.1
  - @danielsimonjr/mathts-parallel@0.6.6

## 0.7.3

### Patch Changes

- 593c70e: The published `.d.ts` files no longer import from `typed-function`, which neither package declares as a dependency. Consumers with `skipLibCheck: false` got TS7016 errors (138 in matrix, 39 in compat), because the import resolved to an untyped `typed-function@4.2.2` copy hoisted by other packages. The typed-function exports now use the `TypedFunction` type that `@danielsimonjr/mathts-core` re-exports, so the declarations resolve through a declared dependency.

## 0.7.2

### Patch Changes

- 57c8ffd: Rebuilt: ships the current WASM binary (same exports, new SHA-384 manifest) and the current bundler helper. No source change.
- Updated dependencies [57c8ffd]
  - @danielsimonjr/mathts-core@0.15.0
  - @danielsimonjr/mathts-parallel@0.6.5

## 0.7.0

### Minor Changes

- Stiff-ODE follow-ups: matrix `luSolve` + `solveODE` event detection.

  **matrix — new `luSolve(fac, b)` export.** Solves `A·x = b` from an `lu()` factorization (the package had `lu()`
  but no solve step — a real gap). numpy-pinned.

  **functions — `solveODE` linear solve routed onto the matrix LU (threshold hybrid, neutral).** The
  Rosenbrock/RODAS stiff step re-factorized the iteration matrix per RHS with inline elimination; it now factors
  once via matrix `lu()`+`luSolve` for `n ≥ 8` and keeps the inline path for the tiny `n = 1–3` matrices real
  stiff systems use (measured 1.8–8× faster there — `DenseMatrix` allocation overhead dwarfs the trivial work
  until `n ≈ 8`, the same crossover the det/inv fast-paths use). Existing stiff behavior is **bit-for-bit
  unchanged** on the small path; the `n ≥ 8` path is oracle-pinned.

  **functions — `solveODE` event detection (`events` option).** scipy `solve_ivp`-style: `events` is a function
  or array of `g(t, y)` whose zero-crossings are located (cubic-Hermite dense interpolation + bisection), with
  `terminal` (stop at the crossing) and `direction` (±1 sign filter) as function properties or `{event, terminal,
direction}` objects. Returns `tEvents`/`yEvents`; a terminal event truncates the output. Absent the option the
  result shape is unchanged. Event times match `scipy.integrate.solve_ivp(..., events=)` to ~1e-8 or better.

## 0.6.3

### Patch Changes

- Resolve the deduplication campaign's final decisions: a compat compatibility correction and an internal WasmLoader consolidation.

  **compat (behavior change):** `zeros(n)` and `ones(n)` with a single argument now return a length-`n` **vector** (`[0,0,0]` / `[1,1,1]`), matching mathjs, instead of an `n×n` square matrix. Two-argument `zeros(r, c)` / `ones(r, c)` continue to return an `r×c` matrix. compat's purpose is mathjs compatibility, and the previous square result diverged from mathjs (`math.zeros(3)` is a size-`[3]` vector) — this was a bug. Anyone relying on `zeros(n)` returning a square must now pass `zeros(n, n)`.

  **core / functions / matrix (internal, no runtime behavior change):** the shared WASM-loader logic — the SHA-384 integrity verification (`sha384OfBuffer` / `verifyWasmIntegrity` / `loadWasmManifest`) and packaged-binary resolution (`resolvePackagedWasm` / `defaultWasmLocation`) — was byte-identical in `functions` and `matrix` and is now single-sourced in `@danielsimonjr/mathts-core/internal` (`core/src/wasm-loader.ts`), with each package injecting its own binary/manifest path. The SHA-384 verify-before-instantiate security invariant is preserved byte-for-byte (Node `crypto.createHash('sha384')` / browser `crypto.subtle.digest('SHA-384')`, mismatch throws), node built-ins stay behind lazy dynamic `import()`, and core's browser-safe `.` entry is unaffected. The per-package `WasmLoader` class stays local (distinct AS allocation models).

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.0
  - @danielsimonjr/mathts-parallel@0.6.3

## 0.6.2

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.12.0
  - @danielsimonjr/mathts-parallel@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.11.0
  - @danielsimonjr/mathts-parallel@0.6.1

## 0.6.0

### Minor Changes

- Rank-revealing pivoted QR, RQ/QL/LQ decompositions, and `condest`

  Adds `qrPivoted` (Businger-Golub column-pivoted rank-revealing QR — returns `{Q, R, P,
rank}` with `A[:,P]=Q·R` and `|diag(R)|` non-increasing), `rq`/`ql`/`lq` (the QR-family
  variants via the standard flip/transpose reductions), and `condest` (Hager/Higham 1-norm
  condition-number estimator using the existing LU factors, never forming `A⁻¹`). Verified by
  orthogonality/triangularity/reconstruction/rank/cond oracles vs numpy/scipy. Also fixes a
  degenerate-branch reflection in the shared `householder` helper (`beta=-2`→`2`) for the
  length-1 sub-column case that `qrPivoted` exercises.

## 0.5.0

### Minor Changes

- `eig` now exposes complex eigenvectors via a new `vectorsIm` field

  `EigResult` gains `vectorsIm: number[][]` (imaginary parts of the eigenvector
  columns; all-zero for real eigenvalues). JAMA's `hqr2` already computed the
  complex eigenvectors internally (EISPACK convention, stored across two adjacent
  columns of the real transform `V`) but the previous `number[][]` contract dropped
  them as zero columns. Complex-conjugate pairs are now emitted as
  `vectors[k] ± i*vectorsIm[k]`, unit-normalized by the complex 2-norm, with the
  residual `‖A·v − λ·v‖ ≈ 0` verified vs numpy for `{i,−i,3+i,3−i}`. Additive and
  non-breaking: `.values` and `.vectors` are unchanged for real spectra (and
  `.vectors` now carries the real part, previously zero, for complex eigenvalues).
  This unblocks a clean `funm`/`care` off the eigenvector basis.

## 0.4.6

### Patch Changes

- Remove dead `statsVariance`/`statsStd` WASM `AsModule` type declarations

  The internal `AsModule` interface in `matrix/src/backends/WasmLoader.ts` declared
  `statsVariance`/`statsStd` kernel signatures whose JS call paths were retired 2026-07-15
  (the corrected two-pass `variance`/`std` in core). No live caller referenced them. TS-only
  cleanup: the `.wasm` binary and its SHA-384 manifest are unaffected, and the
  general-library `array_variance`/`array_stddev` kernels are retained.

## 0.4.5

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0
  - @danielsimonjr/mathts-parallel@0.6.0

## 0.4.4

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0
  - @danielsimonjr/mathts-parallel@0.5.1

## 0.4.3

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0
  - @danielsimonjr/mathts-parallel@0.5.0

## 0.4.2

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0
  - @danielsimonjr/mathts-parallel@0.4.0

## 0.4.1

### Patch Changes

- Updated dependencies [ea044c4]
  - @danielsimonjr/mathts-gpu@0.2.0

## 0.4.0

### Minor Changes

- abbe883: Fix a 12× JS conversion tax on the GPU path, and correct the acceleration tier order.

  **The bug.** `elementwiseChainGpuDispatch` converted its input with
  `Float32Array.from(f64array)`. That is not the typed-array fast path — it is the generic
  `Array.from` algorithm, which walks the source through the ArrayLike/iterator protocol and
  runs `ToNumber` on every element. Naming the denominators, since they differ:

  - the **conversion alone** was **73× slower** — 433.32 ms versus 5.92 ms for
    `new Float32Array(x)` at n=2²⁰, for an identical result;
  - which made the **end-to-end dispatch 12.2× slower** — **439.80 ms → 36.06 ms** once fixed.

  Three sites were paying it, all on typed-array inputs: the f64→f32 input conversion, the
  f32→f64 conversion on the way back out, and `jsChain`'s copy — that last one slowing the
  **JS fallback tier for every user**, GPU or not.

  **The consequence.** That inflated figure is what made WASM appear to beat the GPU, and
  `functions@0.18.0` shipped a `fuseUnaryChainAsync` tier order of WASM → GPU → JS on the
  strength of it. With the tax removed the GPU is **3.2–8.3× faster than WASM**, so the order
  is now **GPU → WASM → JS**.

  **What changes for you.** Only if you call `enableGpu()`. That flag is the f32-precision
  consent, and the GPU tier will now actually run — so results carry ~7 significant digits
  instead of full f64, and are several times faster. With the flag off (the default) the path
  is exactly WASM → JS and results are bit-identical f64, as before. No result was ever
  incorrect; this is a performance and tier-selection change.

  ⚠️ **The blast radius of the process-global flag grew.** Previously a stray `enableGpu()`
  from a transitive dependency was largely harmless, because WASM ran first and shielded you.
  Now it silently downgrades every chain of ≥65,536 elements to f32. If that matters, pass
  `{ gpu: false }` per call — it overrides the global — or call `disableGpu()`.

  **matrix** (minor, not patch): the exported `DEFAULT_BACKEND_HINTS.gpuThreshold` changes
  100,000 → 65,536 and `DEFAULT_EXTENDED_HINTS.operationThresholds.transpose.gpu` 200,000 →
  65,536, so all GPU thresholds single-source `GPU_MIN_ELEMENTS`. The route is dormant in-tree
  (no `'gpu'` backend is ever registered), but `backendRegistry.register()` is public, so a
  consumer registering `GPUMatrixBackend` would see different routing.

## 0.3.2

### Patch Changes

- **Fix: published types did not compile on current TypeScript.**

  Found by compiling the _actually-packed artifacts_ against TypeScript 7 with
  `skipLibCheck: false`, in a clean project — not by checking the repo, which passes for
  reasons a consumer does not share.

  - **Duplicate WebGPU identifiers.** `gpu`/`matrix` shipped a hard
    `/// <reference types="@webgpu/types" />`. TypeScript ≥ 7's `lib.dom` now declares WebGPU
    itself, so the reference collided (`TS2300: Duplicate identifier 'GPUCommandBufferDescriptor'`).
    The reference is gone; `@webgpu/types` is now an **optional peerDependency** — modern TS
    supplies the types from `lib.dom`, and consumers on older TS can add the package.
  - **`ObjectWrappingMap` / `PartitionedMap` did not implement `Map`.** They assigned
    `[Symbol.iterator]` in the constructor through a cast, so it never appeared in the emitted
    type: `implements Map<K, V>` was a lie that only broke downstream (`TS2420`). Both now
    declare a real `[Symbol.iterator]()` whose return type is **derived from `Map` itself**
    (`ReturnType<Map<K, V>[typeof Symbol.iterator]>`), so it stays correct across TS versions —
    older libs say `IterableIterator`, TS ≥ 5.6 says `MapIterator` (which also needs
    `[Symbol.dispose]`).
  - **`functions` shipped a dangling import.** Its emitted `.d.ts` referenced `../types/index.js`,
    but the package's `files` only included `dist/`, so the module did not exist for consumers
    (`TS2307`). `types/` is now shipped.

- Updated dependencies
  - @danielsimonjr/mathts-gpu@0.1.1

## 0.3.1

### Patch Changes

- 8e9aadb: **Fix: published type declarations did not compile for consumers.**

  A consumer building with `skipLibCheck: false` could not compile against these packages:

  - `TS7016` — the `workerpool` fork declares `types: types/index.d.ts`, but that is a build
    output never committed and never generated for a `github:` dependency, so the module
    resolved fully **untyped**. `@danielsimonjr/mathts-workerpool` now ships a canonical ambient
    declaration (`workerpool.d.ts`) from `dist/` and references it from its own `index.d.ts`, so
    types resolve the same way for us and for consumers. The internal `paths` shims that had
    papered over this (compile-time only, never shipped) were removed, ending the two-tier
    reality where our builds passed and consumers' broke.
  - `TS2665` — `matrix`'s emitted `.d.ts` contained an illegal `declare module 'workerpool'`
    augmentation, inlined by the dts bundler from **516 stale generated `.d.ts` files that had
    accumulated inside `src/`** (untracked `tsc` emissions shadowing their sibling `.ts`). These
    were being picked up as build input and corrupting the published surface. Removed.

- Updated dependencies [8e9aadb]
  - @danielsimonjr/mathts-parallel@0.3.4

## 0.3.0

### Minor Changes

- 4b4ccd6: Extract the WebGPU foundation (device/context, buffer pool, and a generic
  shader manager) into a new shared `@danielsimonjr/mathts-gpu` leaf package.
  matrix's `GPUBackend` now imports the foundation from that package and registers
  its builtin matrix kernels onto the shared `ShaderManager`; the shared GPU device
  is coalesced behind a single, never-throw in-flight `getGpuDevice()`. Every GPU
  foundation symbol remains re-exported from `@danielsimonjr/mathts-matrix`, so no
  downstream consumer breaks. Pure refactor — no behavior change.

### Patch Changes

- b78b8bc: Fix the `sumReduce` WGSL kernel, which never compiled. It named its workgroup
  array `shared` — a **reserved keyword in WGSL** — so the shader failed to parse
  (`error: 'shared' is a reserved keyword`) and the reduction was permanently
  unusable on the GPU. The failure was silent: the compile error surfaced only as an
  uncaptured `GPUValidationError`, and nothing asserted on shader compilation. Renamed
  to `sdata`, and added a browser regression guard that compiles every builtin WGSL
  kernel and fails on any error-severity diagnostic.

## 0.2.2

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0

## 0.2.1

### Patch Changes

- 7b2b651: Remove 8 dead (unreachable, unexported, untested) source files surfaced by the upgraded dependency-graph tool: `expression` `ArgumentsError.ts`; `functions` `utils/{function,log,lruQueue,bignumber/constants}.ts` (a closed import subgraph reachable from nothing); `matrix` `types.ts`; `parallel` `workers/compute.worker.ts` (a superseded worker never built — `matrix.worker.ts` is the live one); `wasm` `env/abort.ts` (a custom AssemblyScript abort handler never wired via asconfig, tree-shaken by `asc`). None were reachable from any package entry point or build root, so the published bundles are byte-identical; this is a source-tree cleanup. Verified: build 22/22, wasm build, typecheck 28/28, test 44/44, eslint clean.
- Updated dependencies [7b2b651]
  - @danielsimonjr/mathts-parallel@0.3.3

## 0.2.0

### Minor Changes

- 583817d: B-4: `svd`'s `fullMatrices` option now works. It was accepted in `SVDOptions` (destructured with a claimed default of `true`) but **ignored** — factors were always thin. With `fullMatrices: true`, the thin factor is completed to a square orthonormal basis (U → m×m for tall inputs, V → n×n for wide ones) via modified Gram-Schmidt with re-orthogonalization, numpy `full_matrices=True` style, so the rectangular-Σ reconstruction `A = U·Σ·Vᵀ` holds exactly. The default is now honestly `false` (thin — the library's actual long-standing behavior, so no output shapes change for existing callers). The two `it.skip` tests blocked on this (tall 3×2, wide 4×6) are unskipped with orthonormality pins — the SVD suite has no skips left.

### Patch Changes

- 5f3b401: B-3: replace the dead `../../../lib/wasm/<file>` legacy fallback in all three wasm loaders (matrix `WasmLoader`, matrix `WASMBackend`, functions `WasmLoader`) with `defaultWasmLocation()` — a package-root-aware resolver that names the canonical `dist/wasm/<file>` location. The old fallback was only correct for the pre-bundling source layout: from a bundled `dist/` it resolved OUTSIDE the repo (the misleading `…/Github/lib/wasm/…` ENOENT warnings), and `<repo-root>/lib/wasm` no longer exists in any layout. The browser branch previously _only_ had the broken legacy URL and never tried the packaged location — it now returns the bundle-relative `./wasm/<file>` URL, which is correct for a served `dist/`. Behavior on the happy path is unchanged (the packaged artifact is found first, and both published tarballs ship it); what changes is that a missing binary now produces an actionable warning pointing at the real expected path, and browser consumers can actually load WASM.
- Updated dependencies [779fcde]
- Updated dependencies [538c672]
  - @danielsimonjr/mathts-core@0.5.0
  - @danielsimonjr/mathts-parallel@0.3.2

## 0.1.14

### Patch Changes

- c041b4e: Fix SVD for exactly-rank-deficient matrices. `svd([[1,2],[2,4]])` returned σ₁ = √5 instead of 5 with a wrong `V` (no reconstruction) — corrupting `pinv` / `lowRankApprox` / `norm2` / `cond` on singular inputs. The bidiagonal Golub-Reinsch `handleZero` never folded the superdiagonal into the diagonal for a trailing/isolated exact-zero singular value. Now, when a zero singular value is detected, the decomposition is recomputed with a robust one-sided Jacobi SVD (with null-space basis completion so `U`/`V` stay orthonormal); the fast Golub-Reinsch path is unchanged for the full-rank common case. Exact reconstruction + orthonormal factors across 2×2 / 3×3 / wide / tall / zero, symmetric and non-symmetric.
- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0

## 0.1.13

### Patch Changes

- Scope the WASM backend to where SIMD actually wins. Matmul (SIMD `f64x2` kernel) and the dense LU/QR/Cholesky/inverse/determinant decompositions stay on WASM; element-wise ops, transpose, reductions, `eig`, and `svd` now run on JS — they were measured 0.2–6× slower on WASM (memory-bound or scalar). Removed the dead WASM branches from `WASMBackend`, repointed `eigWasm`/`svdWasm`/`spectralRadiusWasm` to the JS implementations, and dropped the matmul WASM threshold 500→256 (the SIMD kernel wins from 16²). Results are unchanged; small matmuls are faster and the backend carries less dead code.

## 0.1.12

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0

## 0.1.11

### Patch Changes

- Matrix-factory acceleration + a matrix eigensolver correctness fix + forward-mode AD.

  **fix(matrix): eig — wrong eigenvalues for symmetric matrices with structural zeros.**
  The symmetric-only Givens/Wilkinson eigenvalue path returned grossly wrong
  eigenvalues for symmetric matrices with off-diagonal zeros (e.g. the tridiagonal
  `[[2,-1,0],[-1,2,-1],[0,-1,2]]` gave `[19.05, 2, 0.94]` — sum 22 ≠ trace 6 —
  instead of `[0.586, 2, 3.414]`). Fixed by routing all matrices through the robust
  JAMA orthes/hqr2 solver (verified vs numpy). This also repairs latent wrong
  results in `tensorEig`/`tensorEigWasm`. Note: eigenvectors for symmetric input now
  follow the general solver's convention (they are sign-ambiguous; A·v = λ·v holds).

  **perf(functions): det / inv accelerated.** Large (≥8×8) numeric square matrices
  now route `det` (~20× on 80×80) and `inv` (~9×) through the native Float64Array
  LU instead of boxed `number[][]`. numpy-verified; small / non-numeric / singular
  inputs fall back to the factory unchanged.

  **feat(functions + core): forward-mode automatic differentiation.** A new scalar
  `Dual` type (core, registered for typed dispatch) plus `Dual` signatures on the
  elementary functions (add/sub/mul/div/pow/sin/cos/tan/exp/log/sqrt/square/cube/
  cbrt/abs) make the ordinary functions API differentiable. New entry points
  `derivativeAt` / `valueAndDerivativeAt` / `gradientAt`:

      derivativeAt((x) => multiply(sin(x), x), 2)   // sin(2) + 2·cos(2), exact

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0

## 0.1.10

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-parallel@0.3.0

## 0.1.9

### Changed

- **Rust→AssemblyScript cutover (Phase 7b).** The matrix package now runs its
  heavy WASM ops on the AssemblyScript binary and the Rust backend is retired:
  - `WasmLoader` defaults to `mathts-as.wasm` (opt back into the legacy Rust
    `mathts.wasm` with `MATHTS_WASM_BACKEND=rust`). SHA-384 integrity
    verification is unchanged.
  - `svdWasm` → AS `matrix_svd`; `eigWasm` / `spectralRadiusWasm` → AS
    `matrix_eig_symmetric` / `matrix_spectral_radius`; FFT → AS `fft` / `rfft`
    / `powerSpectrum`. Each keeps its JS fallback. Singular values and FFT
    output are bit-identical to the JS references; eig parity is validated by
    the `A·v ≈ λ·v` residual.
  - Removed the `rust-wasm` backend (`RustWASMBackend`, `RustWasmLoader`), its
    registration, the `'rust-wasm'` `BackendType`, and the dead
    `rustWasmPreferredOps` / `rustWasmThreshold` routing in `BackendManager`.

  No public API changes to the matrix surface. The `lib/wasm/mathts.wasm` Rust
  binary is no longer referenced by this package.

## 0.1.8

### Changed

- Refreshed the bundled AssemblyScript wasm (`dist/wasm/mathts-as.wasm`) to the
  fixed `mathts-wasm@0.1.5` build (sha256 `338258aa…`). The previous bundle was
  built before the special-function accuracy fixes. No behavior change for the
  matrix package — it exposes only linear-algebra operations (always correct),
  not the Bessel/Airy kernels that were fixed — this just keeps the embedded
  binary in sync. Tests: 777 passed.

## 0.1.7

### Patch Changes

- Publish the 2026-06-22 dense-matrix work that was committed after `0.1.6` was published (npm `0.1.6`, dated 2026-06-15, predates these and was stale): direct `Float64Array` access in the dense arithmetic hot loops (≈5× faster 800×800 multiply), and packaging/resolution of the bundled AssemblyScript WASM (`dist/wasm/`) for published/bundled layouts. No API changes.

## 0.1.6

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.5

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## Unreleased

### Tests

- Raised vitest line coverage of the active matrix modules from ~70% to **94%
  subtotal** (every active file ≥ its reachable ceiling). New / expanded suites:
  - `operations/qr.test.ts` — full coverage of the Gram-Schmidt QR (0% → 100%):
    reduced/full modes, tall/wide/1×1, rank-deficient and all-zero fallbacks,
    `A = Q·R` reconstruction + `Qᵀ·Q = I` + upper-triangularity.
  - `backends/Backend.test.ts` (registry select/init/hints) and
    `backends/BackendManager.test.ts` (operation routing, error-fallback,
    adaptive-threshold tuning, config sync) — both ~15–56% → ≥96%.
  - `backends/WASMBackend-as.test.ts` — loads the real AssemblyScript artifact by
    explicit path so the managed-runtime allocation cache + every matrix/array
    kernel + the LU/QR/inverse/determinant/Cholesky decomposition kernels run
    against live WASM (52% → 96%), cross-checked vs JSBackend + math identities.
  - `backends/WasmLoader-as.test.ts`, `WasmLoader-browser.test.ts` — AS managed
    allocation, a hand-assembled no-runtime module to drive the Rust bump
    allocator, and the browser load/precompile arms via stubbed `fetch` /
    `instantiateStreaming` (38% → 89%).
  - `operations/svd-wasm-mock.test.ts`, `operations/eig-wasm-mock.test.ts`,
    `wasm/fft-wasm-mock.test.ts` — inject fake WASM loaders/modules to exercise
    the WASM-dispatch branches (which otherwise need the unbuilt Rust artifact),
    asserting correct marshalling and JS-fallback-on-failure behavior.
  - `security/wasm-integrity.test.ts` — added the manifest-missing-entry and the
    browser SHA-384 / `fetch`-manifest code paths (77% → 100%).
  - Extended `operations/{sqrtm,schur,logm}.test.ts` with edge cases
    (non-square/empty inputs, negative/complex-eigenvalue error paths, larger
    double-shift Schur sweeps, the exported Newton square-root helper).
  - No production code changed; the WASM SHA-384 integrity invariant is preserved.
  - Documented dead/unreachable code surfaced by this pass (no behavior change):
    `schur.ts#qrStepSingle` (the QR-step dispatch can only ever reach the
    double-shift branch), `logm.ts#logmEig` + inverse-scaling loop (the Schur-Padé
    path handles every real-eigenvalue case, and complex cases throw earlier in
    validation), and the never-populated AS memory pool in `WasmLoader.ts`.

## 0.1.4

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.

## 0.1.3

### Patch Changes

- 3d218f5: Fix matrix WASM JS-fallback determinant sign and Windows WASM-loader path.
  - **`determinantJS` sign bug.** The JS fallback computed the permutation parity
    by counting positions where `perm[i] !== i`. That matches actual transposition
    count only when every cycle is a 2-cycle; for any 3-cycle (or larger) it gives
    the wrong parity. Replaced with cycle-decomposition: `sign(P) = (-1)^(n - cycles)`.
    Caught by `tests/wasm/decompositions-as.test.ts > matrix_determinant ...` for
    a 3×3 with a single 2-cycle that surfaced the off-by-`±2` regression.
  - **Windows doubled-drive path.** `URL.pathname` of a `file:///C:/...` URL is
    `/C:/...`, which `fs.readFile` then resolves as drive-relative
    (`C:\C:\...`). All three callers (`WasmLoader.getDefaultWasmPath`,
    `RustWasmLoader.findWasmPath`, `WASMBackend.resolveAsWasmPath`) now use
    `fileURLToPath` for the Node branch, which is cross-platform correct and
    decodes URL %-escapes. Browser branches continue to return `.href` for
    `fetch()`.

- Add SHA-384 integrity verification to all three matrix WASM load paths.

  `CLAUDE.md` documents the invariant: "functions/src/wasm/WasmLoader.ts
  and assembly/src/bindings/wasm-loader.ts both hash the .wasm buffer and
  compare to wasm-manifest.json before compile/instantiate." matrix's three
  loaders (WasmLoader.loadNodeWasm / loadBrowserWasm / precompile,
  RustWasmLoader.doLoad, WASMBackend.loadAsModule) all skipped this check
  — closed by adding `await verifyWasmIntegrity(buffer, path)` before every
  `WebAssembly.compile`. Browser streaming paths now refuse to stream when
  a manifest is present (streaming would race past `compile` un-verified).

  The matrix helper at `matrix/src/backends/wasm/integrity.ts` is a copy
  of the functions equivalent — matrix can't import functions's copy
  because functions depends on matrix (would create a dep cycle).

  Also closes the manifest-staleness bug surfaced when this change was
  landed: `wasm-rust/scripts/build.sh` now invokes
  `tools/generate-wasm-manifest.mjs` after copying the binary, so every
  Rust rebuild keeps the manifest in sync with the artifact it produced.
  Without this step, the new integrity check would reject every load after
  a rebuild.

  Regression test at `matrix/tests/security/wasm-integrity.test.ts`
  mirrors `functions/tests/security/wasm-integrity.test.ts`.

## 0.1.1

### Patch Changes

- e771b4e: Fix all pre-existing build, typecheck, and configuration issues across the monorepo.

  ### assembly/ (WASM)
  - Fix AssemblyScript build: prefix 114 bare math calls with `Math.`, fix abort path in asconfig.json
  - Add 6 missing inverse trig methods to Complex class (asin, acos, atan, asinh, acosh, atanh)
  - Fix complex_pow calling wrong method (pow → powReal for f64 args)

  ### expression/
  - Enable build: fix broken types.ts import, create tsconfig.json, restore build script
  - Copy shared mathjs utils into package, fix 60+ import paths
  - Export missing types (CompiledExpression, StringOptions), clean up unused @ts-expect-error directives

  ### parallel/ + matrix/ + compat/
  - Fix typecheck failures caused by workerpool shipping raw .ts sources
  - Create workerpool type stub (parallel/types/workerpool.d.ts) with full declarations
  - Redirect workerpool resolution via tsconfig paths in all affected packages

  ### All packages
  - Add @types/node to all 7 workspace package devDependencies
  - Add vitest.config.ts to 5 packages missing local test configs
  - Fix missing beforeAll/afterAll imports in ParallelMatrix tests

- Updated dependencies [e771b4e]
  - @danielsimonjr/mathts-core@0.1.1
  - @danielsimonjr/mathts-parallel@0.1.1
