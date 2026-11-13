---
'@danielsimonjr/mathts-tensor': patch
---

Binary `Tensor` ops accept a `TapedTensor` as the right-hand operand, and read a strided view by its logical elements (#904).
