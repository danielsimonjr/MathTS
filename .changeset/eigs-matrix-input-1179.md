---
'@danielsimonjr/mathts-functions': patch
---

`eigs` of a Matrix of numbers uses the native solver, as the Array input does. Before, it used the general real-arithmetic solver, which threw "failed to converge" for some matrices and returned wrong eigenvectors. The result keeps the value order of a Matrix result and honours `matricize: false`. A matrix of numbers and Fractions (an Array or a Matrix) also takes the native solver, because the factory solves it in numbers: the eigenvector residual of such a 3x3 matrix was 2.3e-6 and is now at rounding size. The values of such an Array now come in the order of the number Array (real part ascending), not in the factory order (|lambda| ascending); a Matrix keeps the factory order. (Refs #1179)
