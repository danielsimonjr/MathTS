---
'@danielsimonjr/mathts-functions': patch
---

`quantileSeq` with a NumPy `method` now matches `numpy.quantile` at low and high probability (Fixes #1110). When the virtual index lies below 0 or at or above n - 1, both interpolation ends now clip to the boundary element, as NumPy does. Before, only the left end clipped, so the result blended the minimum with the second value.

Results change for these methods: `averaged_inverted_cdf` (`quantileSeq([1, 2], 0.25, 'averaged_inverted_cdf')` was 2, now 1), `interpolated_inverted_cdf`, `hazen` (`quantileSeq([2, 5], 0, 'hazen')` was 3.5, now 2), `weibull` (`quantileSeq([1, 2, 3, 4], 0.1, 'weibull')` was 1.5, now 1), `median_unbiased` (`quantileSeq([3, -1, 5, 7, 2], 0, 'median_unbiased')` was -2.2e-16, now -1) and `normal_unbiased`.

`closest_observation` rounded ties to the wrong neighbour. It now takes the lower index only when the tie index is odd, as NumPy does (`quantileSeq([2, 5], 0.75, 'closest_observation')` was 2, now 5; `quantileSeq([4, 1, 3, 2, 6, 5, 9], 0.5, 'closest_observation')` was 3, now 4).
