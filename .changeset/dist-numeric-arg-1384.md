---
'@danielsimonjr/mathts-functions': patch
---

A distribution constructor stores each number parameter as a number. Before, a numeric string, `null`, a BigNumber or a Fraction parameter was stored as it was, so `normalDist('2', 1).mean` was the string `'2'`. Now that parameter is stored as `Number(value)`: `normalDist('2', 1).mean` is 2, and `gammaDist('3', '4')` gives the distribution of the numbers 3 and 4. (Refs #1384)
