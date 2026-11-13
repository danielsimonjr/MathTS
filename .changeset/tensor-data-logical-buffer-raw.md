---
'@danielsimonjr/mathts-tensor': minor
---

Breaking for views: `Tensor.data` returns the logical values in row-major order. For a strided view (a `slice` with a step, an offset or a negative step) it is a dense copy. The raw parent storage is the new `buffer` field, read with `offset` and `strides`. Ops on a view read its logical values, `slice` keeps the label of an unchanged axis, and `TapedTensor.fromTensorAsInput` and `DualTensor.fromTensor` copy the logical values (#902).
