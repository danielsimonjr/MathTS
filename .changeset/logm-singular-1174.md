---
'@danielsimonjr/mathts-matrix': patch
---

matrixLogm confirms each small eigenvalue on a second Schur form of a scaled copy of the matrix. A singular matrix with large entries now throws an error. Before, it gave a wrong finite result. A 2x2 block with a small complex pair takes the same checks. A small eigenvalue must also be at least 2 times the backward error of the Schur form. (Refs #1174)
