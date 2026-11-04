---
'@danielsimonjr/mathts-tensor': minor
---

Add `Tensor.div`, `neg`, `map` and `clone`. `scale` and same-shape element-wise ops keep `axisLabels`. `transpose` walks the output with an allocation-free odometer and throws unless `perm` is a true permutation. Reductions reject duplicate axes and precompute the output offsets. `einsum` validates operand and axis references (an operand axis referenced twice is rejected) and advances offsets incrementally. `fromDenseMatrix` and `toDenseMatrix` copy the flat buffer instead of round-tripping through nested arrays.
