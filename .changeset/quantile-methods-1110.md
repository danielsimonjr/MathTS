---
'@danielsimonjr/mathts-functions': patch
---

`quantileSeq` with a NumPy `method`, number data and a number probability now matches `numpy.quantile` 2.3.5 at low and high probability (Fixes #1110). When the virtual index is below 0, or at or above n - 1, both interpolation ends clip to the boundary element. Before, only the left end clipped, so the result blended the minimum with the second value.

Results change for `averaged_inverted_cdf` (`quantileSeq([1, 2], 0.25, 'averaged_inverted_cdf')` was 2, now 1), `interpolated_inverted_cdf`, `hazen` (`quantileSeq([2, 5], 0, 'hazen')` was 3.5, now 2), `weibull` (`quantileSeq([1, 2, 3, 4], 0.1, 'weibull')` was 1.5, now 1), `median_unbiased` (`quantileSeq([3, -1, 5, 7, 2], 0, 'median_unbiased')` was -2.2e-16, now -1) and `normal_unbiased`.

Behaviour change: `closest_observation` now resolves a tie as Hyndman-Fan type 3 and NumPy 2.3.5 do. A tie takes the even order statistic. `quantileSeq([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.25, 'closest_observation')` was 3, now 2; at 0.75 it was 7, now 8. The old values equal NumPy 1.26.4.

When the clipped boundary element is infinite, the result is NaN, as NumPy (`quantileSeq([-Infinity, 1, 2], 0, 'hazen')` was -Infinity). BigNumber data and a BigNumber probability do not use these methods yet (#1130).
