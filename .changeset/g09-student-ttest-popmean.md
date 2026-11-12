---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-statistics': patch
---

`studentTTest(sample, popmean)` runs a one-sample t-test against the hypothesized mean (SciPy `ttest_1samp`) instead of treating a numeric second argument as a second sample and returning NaN. Non-finite or non-array/non-number second arguments throw `TypeError`.
