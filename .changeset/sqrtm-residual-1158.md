---
'@danielsimonjr/mathts-functions': patch
---

sqrtm keeps a result only when it squares back to the matrix. A matrix with large entries (above about 2^33) or small entries (near 2^-19) now converges: sqrtm runs again on a copy that is scaled by a power of 2. Before, a large matrix threw an error, and a small matrix returned a value with a residual of 4.5e-8. (Refs #1158)
