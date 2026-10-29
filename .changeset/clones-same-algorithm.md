---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-parallel': patch
---

Share one implementation where two functions already ran the same algorithm: Gauss–Jordan solve (`matInv` and the matrix square-root column solver), scalar central differences (`bfgs` and `gradientDescent`), matrix rank, combination-index generation, cumulative max/min, the upper-gamma continued fraction, and chunk assembly. Public names and their numeric results stay the same.
