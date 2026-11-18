---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

Matrices with extreme entries now work in the `functions` kernels, in `lstsq` and in the `svd` family (Fixes #1122, #1124, #1129).

`qr`, `sqrtm`, `inv`, `rank` and `nullspace` of `functions` scale a matrix of plain numbers by an exact power of 2 when its largest entry is outside a window, as in #1104, and scale the result back. The window is 2^-400 to 2^400 for `inv`, 2^-20 to 2^400 for `qr`, `sqrtm`, `rank` and `nullspace`. A matrix inside its window takes the old path. The scale helpers (`withPow2Scale`, `entryRange`, `ldexp` and others) now live once in `@danielsimonjr/mathts-core/internal`, and `matrix` re-exports them from its `common.ts`.

A differential against the build before this change compared each changed function on 2,200 ordinary random matrices of size 1 to 6 (largest entry 1e-5 to 1e4) and on 200 matrices in each of the classes 2^-21 to 2^-19, 2^399 to 2^401, 2^-401 to 2^-399 and 1e4 to 1e12. A changed result was compared with NumPy 2.3.5 or SciPy 1.16.3. The ordinary and 1e4 to 1e12 classes are bit-equal for every function. No result is further from NumPy, except in the lstsq span class below:

| Function    | Class            | Bit-equal | Changed, closer | Changed, worse | Changed, same error |
| ----------- | ---------------- | --------- | --------------- | -------------- | ------------------- |
| `qr`        | 2^-401 to 2^-399 | 7         | 176             | 0              | 17                  |
| `rank`      | 2^-401 to 2^-399 | 0         | 200             | 0              | 0                   |
| `nullspace` | 2^-401 to 2^-399 | 0         | 200             | 0              | 0                   |
| `sqrtm`     | 2^-21 to 2^-19   | 102       | 98              | 0              | 0                   |
| `sqrtm`     | 2^399 to 2^401   | 192       | 8               | 0              | 0                   |
| `sqrtm`     | 2^-401 to 2^-399 | 0         | 200             | 0              | 0                   |
| `lstsq`     | span (300)       | 78        | 96              | 84             | 42                  |

Every other function and class is bit-equal. These include `inv`, and `lstsq`, `svd`, `singularValues`, `pinv`, `cond`, `norm2` and `lowRankApprox` of `matrix`. The span class has 300 inputs per function. Its matrices (or right-hand sides of `lstsq`) have one entry below 2^-1022 times the largest entry. The `svd` family is bit-equal there too. In the `lstsq` span class, the error relative to the largest entry of the NumPy solution changes by at most 3.9 eps in either direction. It is rounding noise in the QR steps, and the small entries of `b` are no longer lost.

Known limits:

- `rank` and `nullspace` still change at the window edge 2^-20, because the absolute pivot test applies inside the window (#1157).
- `sqrtm` can throw between 2^70 and 2^400, because its absolute stop test cannot be met when one unit in the last place of the root is larger than 1e-6 (#1158).
- `qr` gives a different result for 101 random matrices with a largest entry below 2^-43. 61 of them differ only in the sign of a row of R.

- `qr([[3e200, 1e200], [4e200, 2e200]]).R` was NaN. It is now `[[5e200, 2.2e200], [0, 4e199]]` (NumPy gives the same up to the sign of the first row).
- `qr` of a matrix with entries below about 2^-51 returned the upper triangle of the input as R, because an absolute zero test skipped every reflection. `qr([[1.3, -0.4, 0.7], [0.2, 2.1, -1.1], [-0.9, 0.5, 1.6]] · 2^-60).R` is now 2^-60 times the R of the unscaled matrix. For a largest entry below 2^-43, a result that was a valid factorization can also change, most often in the sign of a row of R.
- `sqrtm([[4e200, 1e200], [1e200, 3e200]])` was NaN. It is now `[[1.98158e100, 2.70832e99], [2.70832e99, 1.71075e100]]`, as in SciPy. Above 2^400, the unscaled iteration is tried first and kept when it is finite. Else the matrix is scaled to a largest entry in [1, 4). Before, `sqrtm` of a well-conditioned 2×2 matrix times 2^450 threw "could not converge"; it is now 2^225 times the root of the unscaled matrix.
- `sqrtm([[4e-20, 1e-20], [1e-20, 3e-20]])` had a diagonal of 9.5e-7, because the stop test is absolute. It is now `1.98158e-10` and `1.71075e-10`, as in SciPy.
- `inv([[1e200, 1e200], [0, 2e200]])` was all 0. It is now `[[1e-200, -5e-201], [0, 5e-201]]`. `inv([[1e-200, 1e-200], [0, 2e-200]])` threw "determinant is zero". It is now `[[1e200, -5e199], [0, 5e199]]`, as in NumPy.
- `rank([[1e-20, 1e-20], [0, 2e-20]])` was 0 and `nullspace` was the identity. They are now 2 and `[]`, as in NumPy. An explicit `tol` is still an absolute pivot tolerance, so `rank(A, 1e-10)` of that matrix is still 0.

`lstsq` divided every entry of `b` by the largest one, so the small entries of an extreme `b` became 0. When that division would push a nonzero entry below 2^-1022, `b` is now divided by the exact power of 2 that brings its largest entry into 2^-400 to 2^400, or by 1 when that power is 2^0 or would also push a nonzero entry below 2^-1022. Any other `b` gives the same bits as before. `lstsq(I, [[1e200, 1e-200], [0, 1e-200]])` was `[[1e200, 0], [0, 0]]`. It is now `[[1e200, 1e-200], [0, 1e-200]]`, as in NumPy. `lstsq(I, [1e100, 1e-300])` was `[1e100, 0]`, and `lstsq(I, [3, 1e-310])` was `[3, 9.9999999999995e-311]`. They are now `[1e100, 1e-300]` and `[3, 1e-310]`.

The `svd` family can keep an unscaled kernel run for a matrix whose entries span more than the double range. That run is now kept only when its singular values are finite and each one is within 1e-10 times the largest singular value of the scaled run. Before, a finite run was kept. `pinv([[1e200, 0, 0], [0, 1, 0], [0, 0, 1e-200]])` of `matrix` returned all zeros. It is now `diag(1e-200, 0, 0)`, as in NumPy. `singularValues([[0, 0, 0], [0, 2e87, 1e86], [1e64, 0, 1e-267]])` was `[2e87, 1e86, 1e64]`. It is now `[2.0024984394500785e87, 1e64, 0]`, as in NumPy.
