---
'@danielsimonjr/mathts-autograd': patch
---

Fix TapedTensor and DualTensor elementwise add/mul to use Tensor broadcasting rules, including scalar add and correct gradient reduction over broadcast axes (issue #747).
