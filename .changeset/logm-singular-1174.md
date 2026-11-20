---
'@danielsimonjr/mathts-matrix': patch
---

matrixLogm confirms each small eigenvalue on a second Schur form of a scaled copy of the matrix. A singular matrix with large entries now throws an error. Before, it gave a wrong finite result. (Refs #1174)
