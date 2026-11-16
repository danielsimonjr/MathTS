---
'@danielsimonjr/mathts-functions': patch
---

`cov` of a 1-D array with no second vector returns the sample variance, as `numpy.cov` does. It returned `[]` before (#980).
