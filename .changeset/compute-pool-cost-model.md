---
'@danielsimonjr/mathts-workerpool': patch
'@danielsimonjr/mathts-parallel': minor
---

`ComputePool.matmul` runs a product in the calling thread below 7,077,888 multiply-adds (`aRows * aCols * bCols`, 192 x 192 x 192), up from 4,096 result elements. A `thresholdByOp.matmul` value set by a user now counts multiply-adds. The matrix kernel packs two columns of B and gives the same bits as the plain triple loop. The in-process `sin`, `cos`, `tan`, `exp` and `log` run one loop per function. New `ComputePool.warmup(count?)` starts the workers before the first parallel call.
