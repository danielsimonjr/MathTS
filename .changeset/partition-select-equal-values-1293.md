---
'@danielsimonjr/mathts-functions': patch
---

`partitionSelect` no longer takes quadratic time on equal values. Each pass sent every value that equals the pivot to the right part, so a range of equal values became smaller by one value per pass. `partitionSelect(new Array(20000).fill(5), 10000)` took 41.8 s. Each pass now splits the range into values less than, equal to and greater than the pivot, and stops when k is in the equal part. `quantileSeq` and `median` of BigNumber, Fraction and Unit data use this selection: `quantileSeq` of 2000 equal BigNumbers took 8.2 s.

(Refs #1293)
