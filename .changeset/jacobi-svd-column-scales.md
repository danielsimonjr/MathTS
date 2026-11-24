---
'@danielsimonjr/mathts-matrix': patch
---

Keep singular vectors normalized and retain small representable singular values in the Jacobi fallback by computing column norms and rotations without squaring away their scale.
