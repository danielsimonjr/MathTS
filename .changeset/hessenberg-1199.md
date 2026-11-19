---
'@danielsimonjr/mathts-functions': patch
---

`hessenbergForm` no longer fails on a matrix of small or large scale. The function scales the matrix by an exact power of 2 before it builds the Householder reflectors, as `qr` does. At scale 2^-60 the reconstruction error was 2 and is now about 1e-16. At scale 2^1000 the result was NaN and is now correct. Fixes #1199.
