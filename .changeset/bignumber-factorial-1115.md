---
'@danielsimonjr/mathts-functions': patch
---

`factorial` and `gamma` of a large integer BigNumber use the Stirling series above n = 10000 (and above 100 times the precision). `factorial(bignumber(1e9))` returns in milliseconds and was never returning. A result below that limit stays the exact product. An n above the range of a number gives `Infinity`. (Refs #1115)
