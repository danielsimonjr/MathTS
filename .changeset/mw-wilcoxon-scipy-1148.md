---
'@danielsimonjr/mathts-functions': patch
---

`mannWhitneyTest` and `wilcoxon` use the SciPy default methods. The p-values now agree with SciPy. `mannWhitneyTest` uses the exact distribution when a sample has 8 or fewer values and no ties. Otherwise it uses the normal approximation with the tie correction and the continuity correction. `wilcoxon` uses the exact, the permutation or the normal method that SciPy selects, with no continuity correction. For example, `mannWhitneyTest([1, 9, 3], [2, 9, 4])` gives p = 0.8248 (it gave 0.6625), and `wilcoxon([1, 9, 3, 4], [2, 3, 1, 5])` gives p = 0.625 (it gave 0.5807). When every difference is zero, `wilcoxon` gives the statistic 0 and p = 1 for 2 to 13 differences and p = NaN for more, as SciPy does (it threw); one zero difference still throws, as SciPy raises. (Refs #1148)
