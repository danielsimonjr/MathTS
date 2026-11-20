---
'@danielsimonjr/mathts-tensor': patch
'@danielsimonjr/mathts-autograd': patch
---

`Tensor.matmul` and `TapedTensor.matmul` follow the NumPy `matmul` rules. A rank-1 operand gets an added axis that the result drops (`ones(3).matmul(ones(3))` is a rank-0 tensor of value 3). The batch axes are right-aligned and broadcast, so `ones(4, 3, 5) @ ones(5, 2)` has shape `[4, 3, 2]` and `ones(1, 2, 2) @ ones(3, 2, 2)` has shape `[3, 2, 2]`. The gradient of a broadcast operand is the sum of the full-batch gradient over the repeated axes. (Refs #992)
