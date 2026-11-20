---
'@danielsimonjr/mathts-functions': patch
---

`tTestPower(effectSize, power, alpha, { solveFor: 'nobs' })` is about 3 times faster. The bisection stops when its interval is two adjacent doubles (after about 70 steps, not 200). The result does not change.
