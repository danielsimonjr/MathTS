---
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-matrix': minor
'@danielsimonjr/mathts-parallel': patch
---

Share one implementation where two functions already ran the same algorithm: Gauss–Jordan solve (`matInv` and the matrix square-root column solver), scalar central differences (`bfgs` and `gradientDescent`), matrix rank, combination-index generation, cumulative max/min, the upper-gamma continued fraction, and chunk assembly.

New public exports: `gaussJordanSolve` (matrix), `centralDifferenceGradient` and `upperGammaQ` (functions). `gaussJordanSolve` reads a missing right-hand-side entry as 0, where the old square-root column solver produced NaN. Other public names and their numeric results stay the same.
