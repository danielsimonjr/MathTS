---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

`eig` and `eigvals` throw a RangeError ("eig: QR iteration did not converge") after 1000 QR iterations for one eigenvalue, where a matrix with entries near 1e154 made them run for ever. `mathieuA(3, 1e200)` throws the same error (#989).
