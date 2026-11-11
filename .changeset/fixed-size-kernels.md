---
'@danielsimonjr/mathts-functions': minor
---

Add allocation-free fixed-size kernels for 2-vectors, 3-vectors, quaternions and 3x3 matrices (`vec2Add` … `vec3Cross`, `quatMultiply`, `quatRotate`, `quatIntegrate`, `quatNormalize`, `quatConjugate`, `mat3Multiply`, `mat3MulVec`, `mat3Transpose`, `mat3Inverse`). Each kernel writes into a caller-supplied `out` at an offset, reads all inputs before it writes, and gives the same bits as its allocating twin. A solver loop can call them on `Float64Array` storage without garbage (issue 375).
