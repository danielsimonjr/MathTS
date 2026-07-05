---
'@danielsimonjr/mathts-functions': patch
---

**`shapiroWilkTest` now computes the correct Royston (1995, AS R94) W statistic and p-value.** The previous implementation used plain Blom order-statistic scores without Royston's polynomial tail-weight corrections (a*n, a*{n-1}) and φ renormalization — W was biased low by up to ~2% at small n (0.9014 vs scipy's 0.9166 on an 8-point sample), and the p-value transform used Shapiro-**Francia** constants (−1.2725 + 1.0521·ln n), the wrong test's normalization. After the fix, W agrees with `scipy.stats.shapiro` to ~2e-10 and p to ~6e-8 across pinned samples (`gap-scipy-and-tail-oracles.test.ts`), with the exact n=3 arcsine distribution and Royston's n≤11 / n≥12 branches. Returned W and p values change — they are now the standard ones users can compare against published tables.
