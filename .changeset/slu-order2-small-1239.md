---
'@danielsimonjr/mathts-functions': patch
---

`slu(A, 2, threshold)` factorizes a small square sparse matrix (Fixes #1239). `csAmd` drops the dense columns of the transpose in place, but left the dropped entries in the index and value arrays. The next transpose then counted them and built corrupt column pointers, and the product `A' * A` threw `TypeError: Cannot set properties of undefined`. `csAmd` now truncates both arrays after the compaction. Results on main before this change, order 2 and threshold 0.001: 1x1 `[[4]]`, 2x2 `[[4,3],[6,3]]`, 2x2 identity, 3x3 `[[2,1,0],[1,3,1],[0,1,4]]` and a full 6x6 threw `setting '0'`; a 4x4 tridiagonal threw `setting '1'`; a 5x5 tridiagonal and a 6x6 diagonal already factorized and give the same result. The ordering of every case equals the mathjs 15.2.0 result.
