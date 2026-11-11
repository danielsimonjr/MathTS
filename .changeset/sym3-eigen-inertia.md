---
'@danielsimonjr/mathts-functions': minor
---

Add `eigSym3`, an allocation-free eigen-decomposition of a symmetric 3x3 matrix (cyclic Jacobi; ascending eigenvalues and an orthonormal right-handed eigenvector matrix), and the inertia-tensor operations `rotateTensor` (R I Rᵀ) and `parallelAxis` (Steiner's theorem). They use the conventions of the fixed-size kernels: column-major 3x3, caller-supplied outputs at offsets (issue 377).
