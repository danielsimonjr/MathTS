---
'@danielsimonjr/mathts-functions': patch
---

`curvefit` delegates to `levenbergMarquardt`; LM uses shared `numericJacobian` (forward `h=1e-7`) and `pairwiseDot` for the cost; `svds` uses core `norm2` for overflow-safe normalization.
