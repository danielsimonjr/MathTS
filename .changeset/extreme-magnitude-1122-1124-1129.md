---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

Matrices with extreme entries now work in the `functions` kernels, in `lstsq` and in the `svd` family (Fixes #1122, #1124, #1129).

`qr`, `sqrtm`, `inv`, `rank` and `nullspace` of `functions` scale a matrix of plain numbers by an exact power of 2 when its largest entry is outside a window, as in #1104, and scale the result back. The window is 2^-400 to 2^400 for `inv`, 2^-20 to 2^400 for `qr`, `sqrtm`, `rank` and `nullspace`. A matrix inside its window takes the old path, and the results are bit-identical (2,200 random matrices of size 1 to 6 per function: 0 differences). The scale helpers (`withPow2Scale`, `entryRange`, `ldexp` and others) now live once in `@danielsimonjr/mathts-core/internal`, and `matrix` re-exports them from its `common.ts`.

- `qr([[3e200, 1e200], [4e200, 2e200]]).R` was NaN. It is now `[[5e200, 2.2e200], [0, 4e199]]` (NumPy gives the same up to the sign of the first row).
- `qr` of a matrix with entries below about 2^-51 returned the upper triangle of the input as R, because an absolute zero test skipped every reflection. `qr([[1.3, -0.4, 0.7], [0.2, 2.1, -1.1], [-0.9, 0.5, 1.6]] · 2^-60).R` is now 2^-60 times the R of the unscaled matrix. For a largest entry below 2^-43, a result that was a valid factorization can also change, most often in the sign of a row of R.
- `sqrtm([[4e200, 1e200], [1e200, 3e200]])` was NaN. It is now `[[1.98158e100, 2.70832e99], [2.70832e99, 1.71075e100]]`, as in SciPy.
- `sqrtm([[4e-20, 1e-20], [1e-20, 3e-20]])` had a diagonal of 9.5e-7, because the stop test is absolute. It is now `1.98158e-10` and `1.71075e-10`, as in SciPy.
- `inv([[1e200, 1e200], [0, 2e200]])` was all 0. It is now `[[1e-200, -5e-201], [0, 5e-201]]`. `inv([[1e-200, 1e-200], [0, 2e-200]])` threw "determinant is zero". It is now `[[1e200, -5e199], [0, 5e199]]`, as in NumPy.
- `rank([[1e-20, 1e-20], [0, 2e-20]])` was 0 and `nullspace` was the identity. They are now 2 and `[]`, as in NumPy. An explicit `tol` is still an absolute pivot tolerance, so `rank(A, 1e-10)` of that matrix is still 0.

`lstsq` divided every entry of `b` by the largest one, so the small entries of an extreme `b` became 0. A `b` whose largest entry is outside 2^-400 to 2^400 is now divided by an exact power of 2, or left as it is when that power would push a nonzero entry below 2^-1022. `lstsq(I, [[1e200, 1e-200], [0, 1e-200]])` was `[[1e200, 0], [0, 0]]`. It is now `[[1e200, 1e-200], [0, 1e-200]]`, as in NumPy. `lstsq(I, [1e300, 1e-300])` was `[1e300, 0]`. It is now `[1e300, 1e-300]`. A `b` inside the window gives the same bits as before.

The unscaled `svd` kernel run that is kept for a matrix whose entries span more than the double range is now judged by its singular values: they must be finite and the largest must be nonzero. Before, `pinv` of the `matrix` package kept a run with NaN singular values, because its derived result was a finite matrix of zeros. `pinv([[1e200, 0, 0], [0, 1, 0], [0, 0, 1e-200]])` of `matrix` returned all zeros. It is now `diag(1e-200, 0, 0)`, as in NumPy. The `pinv` of `functions` already gave this result.
