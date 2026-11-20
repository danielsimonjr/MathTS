---
'@danielsimonjr/mathts-functions': patch
---

`quantileSeq` and `median` of BigNumber data now give the same result for every order of the input. The selection compared the values with `compare`, which reads values within the config `relTol` as equal. `quantileSeq([bignumber('1.0000000000002'), bignumber(2), bignumber('1.0000000000001'), bignumber(1)], bignumber('0.5'))` gave 1.0000000000001, and the sorted input gave 1.00000000000015. The selection now compares numbers and BigNumbers exactly. Fraction and Unit data keep `compare`.

(Refs #1292)
