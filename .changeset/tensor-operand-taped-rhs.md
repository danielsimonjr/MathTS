---
'@danielsimonjr/mathts-tensor': minor
---

A binary `Tensor` op given a `TapedTensor` or `DualTensor` operand throws a `TypeError` that names the autograd op to use. Binary ops read a strided view operand by its logical values (#904).
