---
'@danielsimonjr/mathts-matrix': patch
---

`svd`, `pinv`, `lowRankApprox`, `normFro`, `qrPivoted` and `matrixSchur` read a `DenseMatrix` from its storage instead of calling `toArray()` first. Results are bit-identical to the nested-array input.
