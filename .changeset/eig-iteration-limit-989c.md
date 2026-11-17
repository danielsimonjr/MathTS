---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

`eig` and `eigvals` scale the matrix by a power of 2 before the QR iteration, so a matrix with entries above about 1e154 or below about 1e-146 gives correct eigenvalues. Before, `eig([[1,1e154,0],[1e154,4,1e154],[0,1e154,9]])` and `mathieuA(3, 1e200)` never returned, a nonsymmetric matrix at that scale gave NaN, and a tiny matrix gave wrong values. A non-finite eigenvalue throws a RangeError ("eig: an eigenvalue is not finite"), and the QR iteration throws a RangeError ("eig: QR iteration did not converge") after `maxIterations` iterations for one eigenvalue (default 1000; the option was ignored before). `eigs` throws the RangeError of the native solver for a non-finite entry, where it returned NaN or never returned. Trade: the scaling brings the largest entry into range, so a value far below it can go to zero: `eigvals([[1e300,0],[0,1e-300]])` gives `[1e300, 0]`, not `[1e300, 1e-300]` (#989).
