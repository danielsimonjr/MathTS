---
'@danielsimonjr/mathts-functions': patch
---

`quantileSeq` now has one rule for an infinite end and for an overflowing difference. When `right - left` is finite, the blend is NumPy `_lerp`. Otherwise the result is the left end at weight 0 or when both ends are equal, the right end at weight 1, and `left * (1 - gamma) + right * gamma` between. So the quantile at 0 is the minimum, the quantile at 1 is the maximum, and the result does not decrease when the probability increases. One case stays NaN: the blend of the neighbours `-Infinity` and `Infinity` at a weight between 0 and 1, as the median of those two values.

Five results change from NaN to the end value. NumPy gives NaN for these inputs:

- `quantileSeq([1, Infinity], 0)` gives 1.
- `quantileSeq([Infinity, Infinity, 2, 3], 0.75)` gives `Infinity`.
- `quantileSeq([-Infinity, -Infinity], 0.5)` gives `-Infinity`.
- `quantileSeq([-Infinity, 1, 2], 0, 'hazen')` gives `-Infinity`.
- `quantileSeq([-Infinity, 1], 0.25, 'weibull')` gives `-Infinity`.

`quantileSeq([-1.7e308, 1.7e308], 0)` gave NaN and now gives `-1.7e308`. The same values at 0.5 gave `-Infinity` and now give 0.

(Refs #1131)
