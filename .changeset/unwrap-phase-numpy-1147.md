---
'@danielsimonjr/mathts-functions': patch
---

`unwrapPhase` now runs the algorithm of `numpy.unwrap` and takes O(n) time at any phase value. The old code subtracted 2π from the difference to the previous unwrapped value, one turn at a time, so a large step ran up to 2^20 turns for each sample. For 2000 samples that alternate between 0 and 6e6, the old code took 2812 ms and the new code takes 0.2 ms. The new code takes the wrapped step from the raw difference of two neighbours and adds the corrections in one pass.

The results equal `numpy.unwrap` of NumPy 2.3.5 to the last bit. A large step now gives a result that differs from the old result by up to about 3e-11 in relative terms:

- `unwrapPhase([0, 5e3, -5e3, 1e4, 0])` now returns `[0, -1.4155045149500438, 1.4155045149518628, 3.4521762772783404, 6.283185307180247]`. It returned `[0, -1.4155045149763694, 1.4155045149764476, 3.4521762771895084, 6.283185307179586]`.
- `unwrapPhase([0, 6.6e6])` now returns `[0, -2.35992350243032]`. It returned `[0, -2.359923502508572]`.
- `unwrapPhase([0, 1e300])` now returns `[0, 0]`, as `numpy.unwrap` does: at that scale the correction `wrapped - diff` rounds to `-1e300`. It returned `[0, -0.7234267005270212]`.

A step that is NaN, infinite or overflows still gives NaN for that entry and every later entry. Small steps keep their values.

(Refs #1147)
